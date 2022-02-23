<div align="right">
<h1><code>swrr</code></h1>
<sub><b>S</b>tale <b>W</b>hile <b>R</b>evalidate <b>R</b>esource</sub>
<br />
<br />

<p><code>npm add swrr</code> makes resources fast</p>
<span>
<a href="https://github.com/maraisr/swrr/actions/workflows/ci.yml">
	<img src="https://github.com/maraisr/swrr/actions/workflows/ci.yml/badge.svg"/>
</a>
<a href="https://npm-stat.com/charts.html?package=swrr">
	<img src="https://badgen.net/npm/dw/swrr?labelColor=black&color=black&cache=600" alt="downloads"/>
</a>
<a href="https://packagephobia.com/result?p=swrr">
	<img src="https://badgen.net/packagephobia/install/swrr?labelColor=black&color=black" alt="size"/>
</a>
<a href="https://bundlephobia.com/result?p=swrr">
	<img src="https://badgen.net/bundlephobia/minzip/swrr?labelColor=black&color=black" alt="size"/>
</a>
</span>

<br />
<br />
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
