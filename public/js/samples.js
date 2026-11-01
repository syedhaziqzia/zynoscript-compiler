/* Example ZynoScript programs for the "Example" menu. */
const SAMPLES = {
  "Lab handout example": `let x := 5;
let y := 10;
whenTrue x <<= y
    beam "x is smaller";
elseWay
    beam "y is smaller or equal";
halt;
`,
  "Working program": `let whole a := 5;
let whole b := 10;
let whole sum;
let flag big := false;
let phrase msg := "done";
let part rate := 2.5;
let mark grade := 'A';
sum := a +~ b *~ 2;
rate := rate *~ 2;
whenTrue (sum =>> 20) {
    big := true;
} elseWay {
    big := false;
}
spin (a <<= b &&~ !~ big) {
    a := a +~ 1;
}
beam sum;
beam msg;
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
  "Loop with if/else inside": `let whole i := 0;
let whole evens := 0;
let whole odds := 0;
spin (i <<= 10) {
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
};
