# Three.js and TypeScript

_June 2021_

> 🔨 From Udemy [Three.js and TypeScript - Sean Bradley](https://www.udemy.com/course/bootstrap-en-partant-de-zero).

---

<h1 align="center">
    <img src="_readme-img/logos.png">
</h1>

## Test locally

## Launch server

```batch
cd Three.js-TypeScript-Tutorial
npm install
tsc -p ./src/server
tsc -p ./src/client
node dist/server/server.js
```

[http://localhost:3000/](http://localhost:3000/)

<h1 align="center">
    <img src="_readme-img/architecture.jpg">
</h1>

## Overview

`tsc --init` => generate _tsconfig.json_

### Type Annotations

```ts
function foo(bar: string) {
  return "Hello, " + bar;
}

let baz: string = "ABC";

console.log(foo(baz));
```

`tsc foo.ts`

`node foo.js`

### Interfaces

Interface is a structure that defines the contract in your application. The TypeScript compiler does not convert interface to JavaScript. ... It uses interface for type checking. This is also known as "duck typing" or "structural subtyping".

```ts
interface Quux {
  quuz: string;
  corge: number;
}

function foo(bar: Quux) {
  return "Hello, " + bar.quuz + " " + bar.corge;
}

let baz: Quux = { quuz: "ABC", corge: 123 };

console.log(foo(baz));
```

### Classes

A Class is essentially a blueprint of what an object is supposed to look like when implemented. A Class can have initialized properties and methods to help create and modify the objects.

```ts
class Grault {
  private garply: string;

  constructor(quux: Quux, waldo: number[]) {
    this.garply = quux.quuz + " " + quux.corge + " " + waldo;
  }

  public getGarply() {
    return this.garply;
  }
}

interface Quux {
  quuz: string;
  corge: number;
}

let baz = { quuz: "ABC", corge: 123 };

let fred: Grault = new Grault(baz, [1, 2, 3]);

console.log(fred.getGarply());
```

## Dependancies

- [typescript](https://www.npmjs.com/package/typescript): TypeScript is a language for application-scale JavaScript. TypeScript adds optional types to JavaScript that support tools for large-scale JavaScript applications for any browser, for any host, on any OS.

`npm i -g typescript`

- [three.js](https://www.npmjs.com/package/three): The aim of the project is to create an easy to use, lightweight, cross-browser, general purpose 3D library. The current builds only include a WebGL renderer but WebGPU (experimental), SVG and CSS3D renderers are also available in the examples.

`npm i three`

- [@types/node](https://www.npmjs.com/package/@types/node): This package contains type definitions for Node.js (http://nodejs.org/).

`npm i @types/node`

- [express](https://www.npmjs.com/package/express): Fast, unopinionated, minimalist web framework for node..

`npm i express`

## Useful links

- [Three.js and TypeScript Tutorials](https://sbcode.net/threejs/)
