/* Example ZynoScript programs for the "Preset" menu. */
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
  "Working program": `/~~ Working program
    Shows every data type, arithmetic,
    an if/else and a loop. ~~/
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
  "Type casting (as~)": `/~~ Explicit Type Casting with as~
    Converts between whole, part, phrase, flag, and mark. ~~/
let part price := 19.75;
let whole rounded := price as~ whole;      // 19.75 -> 19
let phrase priceTag := rounded as~ phrase; // 19 -> "19"
let whole parsed := "42" as~ whole;        // "42" -> 42
let mark letter := 65 as~ mark;            // ASCII 65 -> 'A'
let whole code := letter as~ whole;        // 'A' -> 65
let flag active := 1 as~ flag;             // 1 -> true

beam "Rounded price: " +~ priceTag;
beam parsed +~ 8;
beam letter;
beam code;
beam active;
halt;
`,
  "Comments guide": `// Single-line comment: everything after // until end of line is ignored
/~~ Multi-line block comment:
    begins with slash-tilde-tilde (/~~)
    and closes with tilde-tilde-slash (~~/) ~~/
let whole score := 90;   // trailing comment after code
let flag passed := score =>> 50 /~~ inline block comment ~~/ ;
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
  "Temperature converter": `/~~ Celsius to Fahrenheit
    F = C * 9 / 5 + 32 ~~/
let part celsius := 25.0;
let part fahrenheit := (celsius *~ 9.0 /~ 5.0) +~ 32.0;
beam "Celsius:";
beam celsius;
beam "Fahrenheit:";
beam fahrenheit;
halt;
`,
  "Star pyramid pattern": `/~~ Centered Star Pyramid Pattern
    Uses nested spin loops to build each row of stars. ~~/
let whole rows := 5;
let whole r := 1;
spin (r <<= rows) {
    let phrase line := "";
    let whole spaces := rows -~ r;
    spin (spaces =>> 0) {
        line := line +~ " ";
        spaces := spaces -~ 1;
    }
    let whole stars := (r *~ 2) -~ 1;
    spin (stars =>> 0) {
        line := line +~ "*";
        stars := stars -~ 1;
    }
    beam line;
    r := r +~ 1;
}
halt;
`,
  "Right triangle stars": `// Right-Angled Star Triangle & Inverted Triangle
let whole n := 5;
let whole row := 1;
beam "Growing Star Triangle:";
spin (row <<= n) {
    let phrase stars := "";
    let whole col := 1;
    spin (col <<= row) {
        stars := stars +~ "* ";
        col := col +~ 1;
    }
    beam stars;
    row := row +~ 1;
}
halt;
`,
  "Diamond star pattern": `/~~ Full Symmetrical Star Diamond
    Prints an upper pyramid followed by an inverted lower pyramid. ~~/
let whole half := 4;
let whole r := 1;
// Upper half
spin (r <<= half) {
    let phrase rowStr := "";
    let whole sp := half -~ r;
    spin (sp =>> 0) {
        rowStr := rowStr +~ " ";
        sp := sp -~ 1;
    }
    let whole st := (r *~ 2) -~ 1;
    spin (st =>> 0) {
        rowStr := rowStr +~ "*";
        st := st -~ 1;
    }
    beam rowStr;
    r := r +~ 1;
}
// Lower half
r := half -~ 1;
spin (r =>> 1) {
    let phrase rowStr := "";
    let whole sp := half -~ r;
    spin (sp =>> 0) {
        rowStr := rowStr +~ " ";
        sp := sp -~ 1;
    }
    let whole st := (r *~ 2) -~ 1;
    spin (st =>> 0) {
        rowStr := rowStr +~ "*";
        st := st -~ 1;
    }
    beam rowStr;
    r := r -~ 1;
}
halt;
`,
  "Multiplication table": `// Formatted Multiplication Table using as~ phrase casting
let whole num := 7;
let whole i := 1;
beam "Multiplication Table for 7:";
spin (i <<= 10) {
    let whole prod := num *~ i;
    beam (num as~ phrase) +~ " x " +~ (i as~ phrase) +~ " = " +~ (prod as~ phrase);
    i := i +~ 1;
}
halt;
`,
  "Prime number checker": `/~~ Prime Number Finder
    Prints all prime numbers from 2 up to 30. ~~/
let whole limit := 30;
let whole n := 2;
beam "Prime numbers up to 30:";
spin (n <<= limit) {
    let flag isPrime := true;
    let whole d := 2;
    spin (d *~ d <<= n &&~ isPrime) {
        whenTrue ((n /~ d) *~ d ~= n) {
            isPrime := false;
        }
        d := d +~ 1;
    }
    whenTrue (isPrime) {
        beam n;
    }
    n := n +~ 1;
}
halt;
`,
  "Palindrome number check": `/~~ Reverse an integer and check if it is a palindrome
    12321 reversed is 12321 -> Palindrome! ~~/
let whole original := 12321;
let whole temp := original;
let whole reversed := 0;
spin (temp =>> 0) {
    let whole digit := temp -~ ((temp /~ 10) *~ 10);
    reversed := (reversed *~ 10) +~ digit;
    temp := temp /~ 10;
}
beam "Original: " +~ (original as~ phrase);
beam "Reversed: " +~ (reversed as~ phrase);
whenTrue (original ~= reversed) {
    beam "Result: Palindrome!";
} elseWay {
    beam "Result: Not a palindrome";
}
halt;
`,
  "FizzBuzz challenge": `// Classic FizzBuzz from 1 to 15
let whole i := 1;
spin (i <<= 15) {
    let flag div3 := (i /~ 3) *~ 3 ~= i;
    let flag div5 := (i /~ 5) *~ 5 ~= i;
    whenTrue (div3 &&~ div5) {
        beam "FizzBuzz";
    } elseWay {
        whenTrue (div3) {
            beam "Fizz";
        } elseWay {
            whenTrue (div5) {
                beam "Buzz";
            } elseWay {
                beam i;
            }
        }
    }
    i := i +~ 1;
}
halt;
`,
  "GCD & LCM (Euclidean)": `/~~ Greatest Common Divisor (GCD) & Least Common Multiple (LCM)
    Uses Euclid's subtraction/remainder loop. ~~/
let whole x := 48;
let whole y := 18;
let whole a := x;
let whole b := y;
spin (b !~ 0) {
    let whole rem := a -~ ((a /~ b) *~ b);
    a := b;
    b := rem;
}
let whole gcd := a;
let whole lcm := (x *~ y) /~ gcd;
beam "GCD of 48 and 18: " +~ (gcd as~ phrase);
beam "LCM of 48 and 18: " +~ (lcm as~ phrase);
halt;
`,
  "Collatz 3n+1 sequence": `/~~ Collatz Hailstone Conjecture
    If even: n = n / 2; if odd: n = 3n + 1 until n reaches 1. ~~/
let whole n := 19;
let whole steps := 0;
beam "Starting Collatz at: " +~ (n as~ phrase);
spin (n =>> 1) {
    whenTrue ((n /~ 2) *~ 2 ~= n) {
        n := n /~ 2;
    } elseWay {
        n := (n *~ 3) +~ 1;
    }
    steps := steps +~ 1;
}
beam "Reached 1 in steps: " +~ (steps as~ phrase);
halt;
`,
  "Decimal to binary": `// Convert a decimal whole number (42) into a binary phrase ("101010")
let whole num := 42;
let whole n := num;
let phrase bits := "";
spin (n =>> 0) {
    let whole bit := n -~ ((n /~ 2) *~ 2);
    bits := (bit as~ phrase) +~ bits;
    n := n /~ 2;
}
beam "Decimal: " +~ (num as~ phrase);
beam "Binary:  " +~ bits;
halt;
`,
  "Caesar cipher (ASCII)": `/~~ Character Encryption using mark <-> whole ASCII Type Casting
    Shifts characters by +3 ASCII positions. ~~/
let whole shift := 3;
let mark c1 := 'C';
let mark c2 := 'O';
let mark c3 := 'D';
let mark c4 := 'E';

let mark e1 := ((c1 as~ whole) +~ shift) as~ mark;
let mark e2 := ((c2 as~ whole) +~ shift) as~ mark;
let mark e3 := ((c3 as~ whole) +~ shift) as~ mark;
let mark e4 := ((c4 as~ whole) +~ shift) as~ mark;

beam "Original word:  " +~ (c1 as~ phrase) +~ (c2 as~ phrase) +~ (c3 as~ phrase) +~ (c4 as~ phrase);
beam "Encrypted (+3): " +~ (e1 as~ phrase) +~ (e2 as~ phrase) +~ (e3 as~ phrase) +~ (e4 as~ phrase);
halt;
`,
  "Sum of digits & root": `// Sum digits of 9875 (9+8+7+5 = 29) and find its single-digit digital root (2)
let whole n := 9875;
let whole temp := n;
let whole sum := 0;
spin (temp =>> 0) {
    let whole d := temp -~ ((temp /~ 10) *~ 10);
    sum := sum +~ d;
    temp := temp /~ 10;
}
let whole root := sum;
spin (root =>> 9) {
    root := (root /~ 10) +~ (root -~ ((root /~ 10) *~ 10));
}
beam "Number:       " +~ (n as~ phrase);
beam "Digit sum:    " +~ (sum as~ phrase);
beam "Digital root: " +~ (root as~ phrase);
halt;
`,
  "Student grade report": `/~~ Weighted Grade Calculator
    Combines part arithmetic, whole casting, and mark letter grades. ~~/
let part midterm := 84.5;
let part finalExam := 92.0;
let part project := 95.5;
let part weighted := (midterm *~ 0.3) +~ (finalExam *~ 0.4) +~ (project *~ 0.3);
let whole roundedScore := weighted as~ whole;
let mark letterGrade := 'F';

whenTrue (roundedScore =>> 89) {
    letterGrade := 'A';
} elseWay {
    whenTrue (roundedScore =>> 79) {
        letterGrade := 'B';
    } elseWay {
        letterGrade := 'C';
    }
}
beam "Weighted average: " +~ (weighted as~ phrase);
beam "Rounded score:    " +~ (roundedScore as~ phrase);
beam "Final grade:      " +~ (letterGrade as~ phrase);
halt;
`,
};
