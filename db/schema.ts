import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const accounts=sqliteTable('form_accounts',{
  userId:text('user_id').primaryKey(),
  document:text('document').notNull(),
  revision:integer('revision').notNull(),
  updatedAt:text('updated_at').notNull(),
});
