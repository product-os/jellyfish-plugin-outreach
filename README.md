# Jellyfish Outreach Plugin

Provides a sync integration for Outreach.

# Usage

Below is an example how to use this library:

```js
import { cardMixins } from '@balena/jellyfish-core';
import { OutreachPlugin } from '@balena/jellyfish-plugin-outreach';

const plugin = new OutreachPlugin();

// Load cards from this plugin, can use custom mixins
const cards = plugin.getCards(context, cardMixins);
console.dir(cards);
```

# Documentation

[![Publish Documentation](https://github.com/product-os/jellyfish-plugin-outreach/actions/workflows/publish-docs.yml/badge.svg)](https://github.com/product-os/jellyfish-plugin-outreach/actions/workflows/publish-docs.yml)

Visit the website for complete documentation: https://product-os.github.io/jellyfish-plugin-outreach

# Testing

Unit tests can be easily run with the command `npm test`.

The integration tests require Postgres and Redis instances. The simplest way to run the tests locally is with `docker-compose`.
You may need to export an `NPM_TOKEN` and values for the environment variables defined in `test.env` before running the command below.

```
npm run test:compose
```
