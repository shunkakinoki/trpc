import {
  HTTPLinkOptions,
  HttpBatchLinkOptions,
  TRPCLink,
  httpBatchLink,
  httpLink,
} from '@trpc/client';
import { AnyRouter } from '@trpc/server';
import { generateCacheTag } from '../shared';

type NextFetchLinkOptions<TBatch extends boolean> = {
  batch?: TBatch;
  revalidate?: number | false;
} & (TBatch extends true ? HttpBatchLinkOptions : HTTPLinkOptions);

// ts-prune-ignore-next
export function experimental_nextHttpLink<
  TRouter extends AnyRouter,
  TBatch extends boolean,
>(opts: NextFetchLinkOptions<TBatch>): TRPCLink<TRouter> {
  return (runtime) => {
    return (ctx) => {
      const { path, input } = ctx.op;
      const cacheTag = generateCacheTag(path, input);
      const revalidate = opts.revalidate ?? false;

      console.log(
        `fetching ${path} with tag ${cacheTag} - revalidate is set to ${revalidate}`,
      );

      const linkFactory = opts.batch ? httpBatchLink : httpLink;
      const link = linkFactory({
        headers: opts.headers as any,
        url: opts.url,
        fetch: (url, fetchOpts) => {
          return fetch(url, {
            ...fetchOpts,
            next: {
              revalidate,
              tags: [cacheTag],
            },
          });
        },
      })(runtime);

      return link(ctx);
    };
  };
}