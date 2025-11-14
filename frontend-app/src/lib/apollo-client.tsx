'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
// PERBAIKAN ADA DI BARIS INI (menggunakan /link/subscriptions):
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'; 
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

// 1. Link HTTP
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_API_GATEWAY_URL ? `${process.env.NEXT_PUBLIC_API_GATEWAY_URL}/graphql` : 'http://localhost:3000/graphql',
});

// 2. Link WebSocket
const wsUrl = (process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000')
  .replace(/^http/, 'ws') + '/graphql';

const wsLink = typeof window !== "undefined" ? new GraphQLWsLink(createClient({
  url: wsUrl,
  connectionParams: () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: token ? `Bearer ${token}` : '',
    };
  },
})) : null;

// 3. Link Autentikasi
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
});

// 4. Split Link (Hanya gunakan wsLink jika di browser/window ada)
const splitLink = typeof window !== "undefined" && wsLink != null
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      authLink.concat(httpLink)
    )
  : authLink.concat(httpLink);

// 5. Client
const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}