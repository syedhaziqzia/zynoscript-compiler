/* Example ZynoScript programs for the "Example" menu. */
const SAMPLES = {
  "Lab handout example": `// Lab handout: compare two numbers
let x := 5;      // type inferred as whole
let y := 10;
whenTrue x <<= y
    beam "x is smaller";
elseWay
    beam "y is smaller or equal";
halt;
`,
  "Working program": `#~ Working program
   Shows every data type, arithmetic,
   an if/else and a loop. ~#
let whole a := 5;
let whole b := 10;
let whole sum;              // declared now, assigned below
let flag big := false;
let phrase msg := "done";
let part rate := 2.5;
let mark grade := 'A';
sum := a +~ b *~ 2;         // *~ binds tighter than +~
rate := rate *~ 2;
whenTrue (sum =>> 20) {
    big := true;
} elseWay {
    big := false;
}
spin (a <<= b &&~ !~ big) { // loop while a <= b and not big
    a := a +~ 1;
}
beam sum;
beam msg;
halt;
`,
  "Comments guide": `// Single-line comment: everything after // is ignored
#~ Block comment:
   can span as many lines as you like
   and ends with a tilde-hash ~#
let whole score := 90;   // trailing comment after code
let flag passed := score =>> 50 #~ inline block ~# ;
whenTrue passed
    beam "Passed!";      // comments never change the output
halt;
`,
  "Lexical errors": `let whole a := 5;
let phrase s := "open;
let whole b := a @ 3;
halt;
`,
  "Syntax error: missing ;": `let whole a := 5;
let whole b := 10
a := a +~ b;
halt;
`,
  "Semantic errors": `let whole a := 5;
let whole a := 7;
let phrase name := "ali";
let flag ok := 3;
b := a +~ 1;
a := a +~ name;
whenTrue (a) {
    beam a;
}
whenTrue (a ~= "ali") {
    beam name;
}
whenTrue (ok &&~ a) {
    beam ok;
}
halt;
`,
  "Loop with if/else inside": `// Count even and odd numbers from 0 to 10
let whole i := 0;
let whole evens := 0;
let whole odds := 0;
spin (i <<= 10) {
    // integer division trick: (i / 2) * 2 == i only for evens
    whenTrue ((i /~ 2) *~ 2 ~= i) {
        evens := evens +~ 1;
    } elseWay {
        odds := odds +~ 1;
    }
    i := i +~ 1;
}
beam evens;
beam odds;
halt;
`,
  "Factorial calculation": `// 5! = 5 * 4 * 3 * 2 * 1
let whole n := 5;
let whole fact := 1;
spin (n =>> 1) {
    fact := fact *~ n;
    n := n -~ 1;      // count down
}
beam "Factorial of 5:";
beam fact;
halt;
`,
  "Fibonacci sequence": `// Print the first Fibonacci numbers
let whole steps := 6;
let whole a := 0;
let whole b := 1;
let whole nextVal := 0;
let whole count := 0;
beam "Fibonacci numbers:";
spin (count <<= steps) {
    beam a;
    nextVal := a +~ b;   // next = previous two added
    a := b;
    b := nextVal;
    count := count +~ 1;
}
halt;
`,
  "Find maximum of 3": `// Track the largest value seen so far
let whole x := 42;
let whole y := 99;
let whole z := 73;
let whole maxVal := x;
whenTrue (y =>> maxVal) {
    maxVal := y;
}
whenTrue (z =>> maxVal) {
    maxVal := z;
}
beam "Maximum value:";
beam maxVal;
halt;
`,
  "Temperature converter": `#~ Celsius to Fahrenheit
   F = C * 9 / 5 + 32 ~#
let part celsius := 25.0;
let part fahrenheit := (celsius *~ 9.0 /~ 5.0) +~ 32.0;
beam "Celsius:";
beam celsius;
beam "Fahrenheit:";
beam fahrenheit;
halt;
`,
};
