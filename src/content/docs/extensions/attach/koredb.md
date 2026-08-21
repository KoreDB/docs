---
title: External KoreDB databases
description: Attach to external KoreDB databases for read-only querying of local and remote database instances.
---

Using the `ATTACH` statement, you can connect to an external KoreDB database. The external KoreDB database can be local or remote, for example,
in an S3 bucket. Attaching to a local KoreDB database does not require installing any extensions. Attaching to a remote
KoreDB database requires installing the [`httpfs`](/extensions/httpfs) extension. Aside from this requirement of installing the `httpfs` extension,
attaching to a local vs. remote KoreDB database works the same way. Therefore, we only document how to attach to a remote KoreDB database here.

## Usage

Please see [Install an extension](/extensions#install-an-extension) and [Load an extension](/extensions#load-an-extension) first before getting started.

### Attach a remote KoreDB database

Use the `ATTACH` statement to attach to a remote KoreDB database:

```cypher
ATTACH <DB_PATH> AS <alias> (dbtype koredb)
```

- `DB_PATH`: Path to the (remote) database file (can either be an S3, GCS or HTTP URL)
- `alias`: Database alias to use. Aliases are mandatory for attaching to external KoreDB databases.

Unlike attaching to external RDBMSs, the alias is not used as a prefix of node and relationship tables. This is because at any point in time,
you can attach to a single external KoreDB database (or be connected to the local KoreDB database you opened at the beginning of your session).
Therefore, you don't need to prefix your node and relationship tables.
Instead, you will use the alias to `DETACH` from the external KoreDB database.

Suppose you are connected to a local database `example.koredb`. After configuring a [S3 connection](/extensions/s3#configure-the-connection), you can attach a KoreDB database hosted on S3 as:

```cypher
ATTACH 's3://koredb-example/university.koredb.koredb' AS uw (dbtype koredb);
```
After attaching a remote KoreDB database, you no longer have access to the original local KoreDB database `example.koredb`.
After the `ATTACH` statement above, you can only query the external KoreDB database under `s3://koredb-example/university.koredb.koredb`.

If you wish to attach to a database hosted on GCS instead, just replace the prefix `s3://` with `gs://` (in this case it would become `gs://koredb-example/university.koredb`). For more information on how to set up KoreDB with GCS, see [here](/extensions/gcs).

#### Execute queries on external KoreDB database
We only allow **read-only** queries to execute on external KoreDB databases (even if the external database is stored on local disk).
```cypher
MATCH (p:Person)
RETURN p.name AS name, p.age AS age;
```

```table
┌────────┬───────┐
│ name   │ age   │
│ STRING │ INT64 │
├────────┼───────┤
│ Alice  │ 30    │
│ Bob    │ 27    │
│ Carol  │ 19    │
│ Dan    │ 25    │
└────────┴───────┘
```

### List attached databases

You can list all the databases you have attached to by running the following command:
```cypher
CALL SHOW_ATTACHED_DATABASES() RETURN *;
```

### Detach from a remote KoreDB database

To detach from an external KoreDB database, use `DETACH [ALIAS]`:

```cypher
DETACH uw;
```

After the `DETACH` statement, you can continue querying your local KoreDB database `example.koredb`. Therefore, detaching
from an external KoreDB database switches your KoreDB database back to the local database you had started your session with.

### Use a local cache for remote files

When connecting to a remote external KoreDB database, say the `s3://koredb-example/university.koredb` database in our example above,
you would use the `httpfs` extension. When querying this remote database in Cypher, KoreDB will make HTTPS calls to the
remote server to query this database. You can speed up your Cypher queries by using the local httpfs cache,
similar to how you can speed up `LOAD FROM` queries using the [local httpfs cache](/extensions/httpfs#local-cache)
for scanning remote files.
You can enable the local cache by running `CALL HTTP_CACHE_FILE=TRUE;` _after_ installing the `httpfs`
extension and _before_ attaching to the remote KoreDB database.
