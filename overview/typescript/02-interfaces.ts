interface Quux {
  quuz: string;
  corge: number;
}

function foo(bar: Quux) {
  return "Hello, " + bar.quuz + " " + bar.corge;
}

let baz: Quux = { quuz: "ABC", corge: 123 };

console.log(foo(baz));
