<div align="left">

<samp>

# swrr

</samp>

<b>S</b>tale <b>W</b>hile <b>R</b>evalidate <b>R</b>esource · <b>an edge pass-through cache utility</b>

<a href="https://npm-stat.com/charts.html?package=swrr">
  <img src="https://badgen.net/npm/dm/swrr?color=black&label=npm%20downloads" alt="js downloads">
</a>
<a href="https://licenses.dev/npm/swrr">
  <img src="https://licenses.dev/b/npm/swrr?style=dark" alt="licenses" />
</a>
<a href="https://unpkg.com/swrr/index.mjs">
  <img src="https://img.badgesize.io/https://unpkg.com/swrr/index.mjs?compression=gzip&label=gzip&color=black" alt="gzip size" />
</a>
<a href="https://unpkg.com/swrr/index.mjs">
  <img src="https://img.badgesize.io/https://unpkg.com/swrr/index.mjs?compression=brotli&label=brotli&color=black" alt="brotli size" />
</a>

<br>
<br>

<sup>

This is free to use software, but if you do like it, consider supporting me ❤️

[![sponsor me](https://badgen.net/badge/icon/sponsor?icon=github&label&color=gray)](https://github.com/sponsors/maraisr)
[![buy me a coffee](https://badgen.net/badge/icon/buymeacoffee?icon=buymeacoffee&label&color=gray)](https://www.buymeacoffee.com/marais)

</sup>

</div>

> **Caveat** ~ Currently cache backplane is assumed to be
> [Cloudflare Workers KV](https://developers.cloudflare.com/workers/runtime-apis/kv). Before we hit 1.0 release, we will
> aim to support a generic and abstract backplane for the likes of Redis, Memcached, or other layers.

## 🚀 Usage

```ts
// file: my-worker.esm.ts

import * as swr from 'swrr';

const getPostsInCategorySince = async ({ category, since }) => {
  const posts = await cms.getPostsInCategory(category);

  return posts.filter((post) => post.updatedAt > since);
};

export default {
  async fetch(req, env, ctx) {
    // ⬇️️ create "container", all resources will batch in this boundary.
    //   ~> you'd probably want this in a middleware.
    const makeResource = swr.make(env.KV_NAMESPACE, ctx);

    // ⬇️ create a resource connected to a handler and name it
    const getLatestPosts = makeResource('posts', getPostsInCategorySince);

    // ... whatever elese

    // ⬇️ run the resource, passing in whatever arguments you'd like
    const posts = await getLatestPosts({ category: 'foobar', since: '2022-01-01' });

    // ~> and one would now find a KV entry for
    //      'posts__cdbdf4617568dc29453d3fee5f5ca79a7713b15f'

    return new Response(posts, { headers: { 'content-type': 'application/json' } });
  },
};
```

## License

MIT © [Marais Rossouw](https://marais.io)
