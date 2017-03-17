/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLInputObjectType,
} from 'graphql';

import {
  connectionArgs,
  connectionDefinitions,
  connectionFromArray,
  fromGlobalId,
  globalIdField,
  mutationWithClientMutationId,
  nodeDefinitions,
} from 'graphql-relay';

import {
  // Import methods that your schema can use to interact with your database
  User,
  Widget,
  getUser,
  getViewer,
  getWidget,
  getWidgets,
  Person,
  getPerson,
  getPeople,
  addPerson,
  makeFriends
} from './database';

/**
 * We get the node interface and field from the Relay library.
 *
 * The first method defines the way we resolve an ID to its object.
 * The second defines the way we resolve an object to its GraphQL type.
 */
var {nodeInterface, nodeField} = nodeDefinitions(
  (globalId) => {
    var {type, id} = fromGlobalId(globalId);
    if (type === 'User') {
      return getUser(id);
    } else if (type === 'Widget') {
      return getWidget(id);
    } else if (type === 'Person') {
      return getPerson(id);
    } else {
      return null;
    }
  },
  (obj) => {
    if (obj instanceof User) {
      return userType;
    } else if (obj instanceof Widget)  {
      return widgetType;
    } else if (obj instanceof Person)  {
      return personType;
    } else {
      return null;
    }
  }
);

/**
 * Define your own types here
 */

var personType = new GraphQLObjectType({
  name: 'Person',
  description: 'A Person',
  fields: () => ({
    id: globalIdField('Person'),
    firstName: {
      type: GraphQLString,
      description: 'A Person\'s firstName',
    },
    lastName: {
      type: GraphQLString,
      description: 'A Person\'s lastName',
    },
    friends: {
      type: new GraphQLList(GraphQLString),
      description: 'A Person\'s friends'
    }
  }),
  interfaces: [nodeInterface],
});

var userType = new GraphQLObjectType({
  name: 'User',
  description: 'A person who uses our app',
  fields: () => ({
    id: globalIdField('User'),
    widgets: {
      type: widgetConnection,
      description: 'A person\'s collection of widgets',
      args: connectionArgs,
      resolve: (_, args) => connectionFromArray(getWidgets(), args),
    },
    person: {
      type: personType,
      args: {
        id: globalIdField('Person'),
      },
      resolve: (_, args) => getPerson(fromGlobalId(args.id).id),
    },
    people: {
      type: personConnection,
      description: 'The people this server knows about',
      args: connectionArgs,
      resolve: (collection, args) => {
        return connectionFromArray(
          getPeople().map(p => new Person(p)),
          args
        );
    },
    }
  }),
  interfaces: [nodeInterface],
});

var widgetType = new GraphQLObjectType({
  name: 'Widget',
  description: 'A shiny widget',
  fields: () => ({
    id: globalIdField('Widget'),
    name: {
      type: GraphQLString,
      description: 'The name of the widget',
    },
  }),
  interfaces: [nodeInterface],
});

/**
 * Define your own connection types here
 */
 var {connectionType: widgetConnection} =
   connectionDefinitions({name: 'Widget', nodeType: widgetType});

 var {connectionType: personConnection} =
   connectionDefinitions({name: 'Person', nodeType: personType});

/**
 * This is the type that will be the root of our query,
 * and the entry point into our schema.
 */
var queryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    node: nodeField,
    // Add your own root fields here
    viewer: {
      type: userType,
      resolve: () => getViewer(),
    },
  }),
});

var createPersonInputType = new GraphQLInputObjectType({
  name: 'CreatePersonInput',
  fields: {
    firstName: { type: new GraphQLNonNull(GraphQLString) },
    lastName: { type: new GraphQLNonNull(GraphQLString) },
    clientMutationId: { type: new GraphQLNonNull(GraphQLString) },
  }
});

var createPersonPayload = new GraphQLObjectType({
  name: 'CreatePersonPayload',
  fields: {
    id: globalIdField('Person'),
    firstName: { type: new GraphQLNonNull(GraphQLString) },
    lastName: { type: new GraphQLNonNull(GraphQLString) },
    clientMutationId: { type: new GraphQLNonNull(GraphQLString) },
  }
});

var updateFriendsMutation = new mutationWithClientMutationId({
  name: 'UpdateFriendsPayload',
  inputFields: {
    id: {
      type: new GraphQLNonNull(GraphQLID)
    },
    friends: {
      type: new GraphQLList(GraphQLString)
    }
  },
  outputFields: {
    person: {
      type: personType,
      resolve: (payload) => payload
    }
  },
  mutateAndGetPayload: ({id, friends}) => makeFriends(id, friends)
})
/**
 * This is the type that will be the root of our mutations,
 * and the entry point into performing writes in our schema.
 */
var mutationType = new GraphQLObjectType({
  name: 'Mutation',
  fields: () => ({
    // Add your own mutations here
    updateFriends: updateFriendsMutation,
    createPerson: {
      type: createPersonPayload,
      description: 'Creates a new Person',
      args: {
        input: { type: createPersonInputType },
      },
      resolve: (_, args) => {
        console.log('args:', args);
        let { firstName, lastName } = args.input;
        let addedPerson = addPerson({ firstName, lastName });
        return {
          id: addedPerson.id,
          firstName: addedPerson.firstName,
          lastName: addedPerson.lastName,
          clientMutationId: args.input.clientMutationId,
        };
      },
    }
  })
});

/**
 * Finally, we construct our schema (whose starting query type is the query
 * type we defined above) and export it.
 */
export var Schema = new GraphQLSchema({
  query: queryType,
  // Uncomment the following after adding some mutation fields:
  mutation: mutationType
});
