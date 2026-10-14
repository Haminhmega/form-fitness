import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const accounts=sqliteTable('form_accounts',{
  userId:text('user_id').primaryKey(),
  document:text('document').notNull(),
  revision:integer('revision').notNull(),
  updatedAt:text('updated_at').notNull(),
});
export const googleIdentities=sqliteTable('form_google_identities',{
  googleSub:text('google_sub').primaryKey(),userId:text('user_id').notNull(),email:text('email').notNull(),name:text('name').notNull(),
},t=>[uniqueIndex('google_user_unique').on(t.userId)]);
export const sessions=sqliteTable('form_sessions',{
  tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('session_user').on(t.userId),index('session_expiry').on(t.expiresAt)]);
export const oauthStates=sqliteTable('form_oauth_states',{
  stateHash:text('state_hash').primaryKey(),nonceHash:text('nonce_hash').notNull(),verifier:text('verifier').notNull(),linkUserId:text('link_user_id'),expiresAt:integer('expires_at').notNull(),
},t=>[index('oauth_expiry').on(t.expiresAt)]);
export const rateLimits=sqliteTable('form_rate_limits',{
  bucket:text('bucket').primaryKey(),hits:integer('hits').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('rate_expiry').on(t.expiresAt)]);
