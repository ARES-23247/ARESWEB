# ARESWEB Architecture

Welcome to the ARESWEB architecture guide. This document explains how our code fits together and how the major systems work.

## The Tech Stack

ARESWEB is built on modern tools that make the site fast, secure, and easy to use.

- **Cloudflare Pages**: This hosts our frontend website. It delivers our code to users very quickly using servers located all around the world.
- **Cloudflare D1**: This is our main database. It stores everything from user roles to store items. We use a tool called **Kysely** to safely write our database queries and prevent errors.
- **Hono**: This is the framework we use to build our backend API. It handles web requests, checks if users are allowed to see certain data, and talks to our D1 database.
- **React & Vite**: We build the visual parts of our website with React. We use Vite to build and bundle our code because it is incredibly fast.

## Collaborative Editing

One of the best features of ARESWEB is that multiple people can edit task descriptions and posts at the exact same time, just like in Google Docs. Here is how that works.

### Tiptap and Liveblocks
We use two main tools to make this happen: **Tiptap** (a text editor) and **Liveblocks** (a real-time syncing service). 

When you type in the editor, Tiptap uses special plugins to talk to a Liveblocks "provider." The Liveblocks provider takes your keystrokes and instantly shares them with anyone else looking at the same page.

### Handling Conflicts with Y.js
To make sure people do not overwrite each other's work, we use a technology called a **CRDT** (Conflict-free Replicated Data Type). Specifically, we use a tool named **Y.js**.

- If two people type on the exact same line at the same time, Y.js merges their changes smoothly so nothing is lost.
- It also tracks everyone's mouse cursors and text selections, so you can always see where your teammates are working.

### Saving the Document (AST Migration Flow)
When it is time to save the document to the database, we do not just save standard HTML or raw text. Instead, we convert the document into an **AST** (Abstract Syntax Tree). 

An AST is a deeply structured, organized format. We save this AST format into our Cloudflare D1 database because it is much safer than saving HTML. When a user views the document later, we read the AST and rebuild the text perfectly. This prevents security risks and ensures the formatting always looks right.
