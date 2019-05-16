import { prisma } from './generated/prisma-client'
import datamodelInfo from './generated/nexus-prisma'
import * as path from 'path'
import { makePrismaSchema } from 'nexus-prisma'
import { GraphQLServer } from 'graphql-yoga'
import { rule, shield } from 'graphql-shield'
import { ContextParameters } from 'graphql-yoga/dist/types'
// import { clearConfigCache } from 'prettier'
// import { INSPECT_MAX_BYTES } from 'buffer'

import Query from './query'
import Mutation from './mutation'

import permissions from './permissions'

import { Aliment, AuthPayload } from './schemas'

import { getUser } from './auth'

const schema = makePrismaSchema({
	types: [ Query, Mutation, Aliment, AuthPayload ],
	prisma: {
		datamodelInfo,
		client: prisma
	},
	outputs: {
		schema: path.join(__dirname, './generated/schema.graphql'),
		typegen: path.join(__dirname, './generated/nexus.ts')
	}
})

const server = new GraphQLServer({
	schema,
	context: (req: ContextParameters) => ({
		...req,
		user: getUser(req),
		prisma
	}),
	middlewares: [ permissions ]
})
server.start(() => console.log('Server is running on http://localhost:4000'))