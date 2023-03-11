# FormData proposal

- [FormData proposal](#formdata-proposal)
  - [Challenges](#challenges)
  - [Practical example](#practical-example)
    - [What this means for tRPC](#what-this-means-for-trpc)
  - [Dummy code example code](#dummy-code-example-code)
    - [Schema](#schema)
    - [Backend](#backend)
    - [Usage in frontend](#usage-in-frontend)
    - [Internals](#internals)
      - [How this looks like for the tRPC client](#how-this-looks-like-for-the-trpc-client)
      - [How this request to the server would actually look like](#how-this-request-to-the-server-would-actually-look-like)


> Have a lookout for the ❓-emoji where we need some more thinking

## Challenges

- We don't know *all* of the form's input before we have handled the data
- We want to be able to use [multiple input parsers](https://trpc.io/docs/procedures#multiple-input-parsers) to do things like auth checks **before** we start handling form data and writing to disk or in memory
  - Otherwise, any authenticated user may very easily DDoS our apps

## Practical example

- We have a chat room where can send messages
- The chat room has a `roomId`
- A user needs to needs to be authenticated and part of the room to send a message
- A message can contain a file

### What this means for tRPC


- We need to know the chat room where you're sending the message to **before** starting to parse the form data
- Therefore, there must(❓) be a distinction between "input" and "form data" - **they are different primitives**
- Probably, we want to send `input` as a query parameter (or request header next to the request❓) that can be handled before we start working through the `req.body`


## Dummy code example code

### Schema

```ts
export const sendMessageSchema = z.object({
  text: z.string(),
  // Send a file with the message
  file: createZodFileSchema({
    // types: ['image/png'],
    maxSize: '1mb',
    optional: true,
  }),
})



// ❓ maybe this should use zod-form-data?
const alt = zfd.formData({

})
```

### Backend

```ts

const roomProcedure = publicProcedure
  .input(
    z.object({
      roomId: z.string(),
    }),
  )
  .use((opts ) => {
    // ... auth check that you're *in* the room

    return opts.next();
  });

export const appRouter = router({
  sendMessage: roomProcedure
    .use(
      // This could/should be abstracted to some helper fn 
      async (opts) => {
        // Somewhat stolen from Remix
        // ❓ Def not the best API we can do
        const uploadHandler = unstable_createMemoryUploadHandler({
          maxSize: '1mb',
        });

        const form = await unstable_parseMultipartFormData({
          schema: sendMessageSchema,
          request: opts.req,
          uploadHandler,
        })
        return opts.next({
          form,
        })
      })
    )
    .mutation((opts) => {
      const {
        ctx,
        input
      } = opts;
      input.roomId;
      //       ^? string
      ctx.form.file
      //        ^? FormDataFileStream
      ctx.form.text
      //        ^? string
    }),
});
```

### Usage in frontend

Imaginary `createForm`-helper

```tsx
const form = createForm({
  schema: sendMessageSchema,
  procedure: trpc.sendMessage,
});


function MyComponent() {
  // Pretend we're at path `/room/123`
  const roomId = useRouter().query.roomId as string;

  return (
    <form.Form 
      // If the procedure is part of a base procedure that requires input,
      // It needs to be set here, and will be sent as query parameters
      input={{ roomId }}
    >
      <input {...form.register('text')} />
      <input type="upload" {...form.register('file')} />

      <input type="submit" />
    </form.Form>
  )
}

```
### Internals

#### How this looks like for the tRPC client

- The `FormData` can be passed through `context`, e.g. `{ trpc: { formData: new FormData } }`
- The `input` is passed as now (`{roomId: xx}`)
- We can provide a `splitLink` that checks for `trpc.formData` and 


#### How this request to the server would actually look like

- `input` here is `encodeURIComponent(JSON.stringify({ roomId: '123' }))`

```sh
curl -X POST \
  'https://example.com/trpc/sendMessage?input=%7B%22roomId%22%3A%22123%22%7D' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@/path/to/textfile.txt' \
  -F 'text=hello form'
```

