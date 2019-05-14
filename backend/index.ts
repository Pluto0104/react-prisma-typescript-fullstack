import { prisma, } from "./generated/prisma-client"
import datamodelInfo from "./generated/nexus-prisma"
import * as path from "path"
import { arg, stringArg, idArg, enumType, objectType, } from "nexus"
import { prismaObjectType, makePrismaSchema, } from "nexus-prisma"
import { GraphQLServer, } from "graphql-yoga"
import { rule, shield, } from "graphql-shield"
import * as yup from "yup"
import { ContextParameters, } from "graphql-yoga/dist/types"
import { clearConfigCache, } from "prettier"
import { INSPECT_MAX_BYTES, } from "buffer"

import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const Query = prismaObjectType({
  name: "Query",
  definition: t => {
    t.prismaFields(["post",])
    t.list.field("feed", {
      type: "Post",
      resolve: (_, args, ctx) =>
        ctx.prisma.posts({ where: { published: true, }, }),
    })
    t.list.field("postsByUser", {
      type: "Post",
      args: { email: stringArg(), },
      resolve: (_, { email, }, ctx) =>
        ctx.prisma.posts({ where: { author: { email, }, }, }),
    })
  },
})

const Mutation = prismaObjectType({
  name: "Mutation",
  definition: t => {
    t.prismaFields(["createUser", "deletePost",])
    t.field("createDraft", {
      type: "Post",
      args: {
        title: stringArg(),
        authorId: idArg({ nullable: true, }),
      },
      resolve: (_, { title, authorId, }, ctx) =>
        ctx.prisma.createPost({
          title,
          author: { connect: { id: authorId, }, },
        }),
    })
    t.field("publish", {
      type: "Post",
      nullable: true,
      args: { id: idArg(), },
      resolve: (_, { id, }, ctx) =>
        ctx.prisma.updatePost({
          where: { id, },
          data: { published: true, },
        }),
    })
    t.field("testoss", {
      type: "Test",
      args: {
        aliment: arg({
          type: "Aliment",
        }),
      },
      resolve: (_, { aliment, }, ctx) => {
        console.log("aliment: " + aliment)
        // const yupVal =
        AlimentYupSchema.validateSync(aliment)

        // console.log({ yupVal })

        return {
          id: "",
          lol: aliment,
        }
      },
    })
    t.field("signup", {
      type: "AuthPayload",
      args: {
        name: stringArg(),
        email: stringArg(),
      },
      resolve: async (_, { name, email, password, }, ctx) => {
        const password2 = await bcrypt.hash(password, 10)

        const user = await ctx.prisma.createUser({
          name,
          email,
          password: password2,
        })

        return {
          token: jwt.sign({ userId: user.id, }, "APP_SECRET"),
          user,
        }
      },
    })
  },
})

const AlimentYupSchema = yup.mixed().oneOf(["Poulet", "Frites",])

const Aliment = enumType({
  name: "Aliment",
  members: ["Poulet", "Frites", "Error",],
  description: "A boufer !",
})

const AuthPayload = objectType({
  name: "AuthPayload",
  definition: t => {
    t.string("token")
    t.field("user", {
      type: "User",
    })
  },
})

const schema = makePrismaSchema({
  types: [Query, Mutation, Aliment, AuthPayload,],
  prisma: {
    datamodelInfo,
    client: prisma,
  },
  outputs: {
    schema: path.join(__dirname, "./generated/schema.graphql"),
    typegen: path.join(__dirname, "./generated/nexus.ts"),
  },
})

const getUser = (req: ContextParameters) => {
  const auth = req.request.get("Authorization")
  if (auth === "admin") {
    return { role: "admin", }
  } else if (auth) {
    return { role: "user", }
  } else {
    return null
  }
}

// Rules

const isAuthenticated = rule()(async (parent, args, ctx, info) => {
  return ctx.user !== null
})

const isAdmin = rule()(async (parent, args, ctx, info) => {
  return ctx.user.role === "admin"
})

const isUser = rule()(async (parent, args, ctx, info) => {
  return ctx.user.role === "user"
})

// Permissions

const permissions = shield(
  {
    Query: {
      feed: isAuthenticated,
    },
    Mutation: {
      testoss: isAuthenticated,
    },
    Test: isAdmin,
    Aliment: isAuthenticated,
    // Post: isAdmin
  },
  { debug: true, }
)

const server = new GraphQLServer({
  schema,
  context: (req: ContextParameters) => ({
    ...req,
    user: getUser(req),
    prisma,
  }),
  middlewares: [permissions,],
})
server.start(() => console.log("Server is running on http://localhost:4000"))
