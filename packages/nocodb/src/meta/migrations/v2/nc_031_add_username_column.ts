import { MetaTable } from '../../meta.service';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.string('username');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumns('username');
  });
};

export { up, down };
