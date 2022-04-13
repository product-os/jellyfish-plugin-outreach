# Jellyfish Outreach Plugin

Provides a sync integration for Outreach.

# Usage

Below is an example how to use this library:

```js
import { defaultPlugin } from '@balena/jellyfish-plugin-default';
import { outreachPlugin } from '@balena/jellyfish-plugin-outreach';
import { PluginManager } from '@balena/jellyfish-worker';

// Load cards from this plugin
const pluginManager = new PluginManager([defaultPlugin(), outreachPlugin()]);
const cards = pluginManager.getCards();
console.dir(cards);
```

# Documentation

[![Publish Documentation](https://github.com/product-os/jellyfish-plugin-outreach/actions/workflows/publish-docs.yml/badge.svg)](https://github.com/product-os/jellyfish-plugin-outreach/actions/workflows/publish-docs.yml)

Visit the website for complete documentation: https://product-os.github.io/jellyfish-plugin-outreach

# Testing

Unit tests can be easily run with the command `npm test`.

The integration tests require Postgres and Redis instances. The simplest way to run the tests locally is with `docker-compose`.

```
git secret reveal -f
npm run test:compose
```

You can also run tests locally against Postgres and Redis instances running in `docker-compose`:
```
git secret reveal -f
npm run compose
REDIS_HOST=localhost POSTGRES_HOST=localhost npm run test:integration
```

You can also access these Postgres and Redis instances:
```
PGPASSWORD=docker psql -hlocalhost -Udocker
redis-cli -h localhost
```
