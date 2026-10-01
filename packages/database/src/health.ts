export interface Queryable {
  query(queryText: string): Promise<unknown>;
}

export async function checkDatabaseConnection(client: Queryable): Promise<void> {
  await client.query("select 1 as healthy");
}
