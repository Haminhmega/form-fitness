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
export const passwordIdentities=sqliteTable('form_password_identities',{
  userId:text('user_id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),passwordHash:text('password_hash').notNull(),salt:text('salt').notNull(),iterations:integer('iterations').notNull(),createdAt:text('created_at').notNull(),emailVerifiedAt:text('email_verified_at'),credentialVersion:integer('credential_version').notNull().default(0),
},t=>[uniqueIndex('password_email_unique').on(t.email)]);
export const sessions=sqliteTable('form_sessions',{
  credentialVersion:integer('credential_version').notNull().default(0),tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('session_user').on(t.userId),index('session_expiry').on(t.expiresAt)]);
export const oauthStates=sqliteTable('form_oauth_states',{
  stateHash:text('state_hash').primaryKey(),nonceHash:text('nonce_hash').notNull(),verifier:text('verifier').notNull(),linkUserId:text('link_user_id'),expiresAt:integer('expires_at').notNull(),
},t=>[index('oauth_expiry').on(t.expiresAt)]);
export const rateLimits=sqliteTable('form_rate_limits',{
  bucket:text('bucket').primaryKey(),hits:integer('hits').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('rate_expiry').on(t.expiresAt)]);
export const rewards=sqliteTable('form_rewards',{
  userId:text('user_id').primaryKey(),
  document:text('document').notNull(),
  revision:integer('revision').notNull(),
  updatedAt:text('updated_at').notNull(),
});

export const emailCodes=sqliteTable('form_email_codes',{
  id:text('id').primaryKey(),email:text('email').notNull(),purpose:text('purpose').notNull(),codeHash:text('code_hash').notNull(),expiresAt:integer('expires_at').notNull(),attempts:integer('attempts').notNull().default(0),consumedAt:integer('consumed_at'),
},t=>[index('email_code_expiry').on(t.expiresAt),index('email_code_address').on(t.email,t.purpose)]);
export const analyticsConsent=sqliteTable('form_analytics_consent',{
  userId:text('user_id').primaryKey(),enabled:integer('enabled').notNull(),updatedAt:integer('updated_at').notNull(),
});
export const usageEvents=sqliteTable('form_usage_events',{
  id:text('id').primaryKey(),subject:text('subject').notNull(),kind:text('kind').notNull(),at:integer('at').notNull(),
},t=>[index('usage_time').on(t.at),index('usage_subject_time').on(t.subject,t.at)]);
