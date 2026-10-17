// config/database.js reads NODE_ENV when it is first required, and only the
// testing branch gives each jest worker its own in-memory database. Invoked as
// a bare `jest`, without the cross-env the test script supplies, every worker
// would instead share one sqlite file and the suites would drop each other's
// tables.
process.env.NODE_ENV = 'testing';
