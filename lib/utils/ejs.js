/**
ejs parsing.
Like erb, but javascript.

This parser keeps line numbers intact, and generates a function with a meaningful name
for the good of your stack traces when errors happen.  Also, it doesn't choke on quotes
or regular expressions or line-breaks.

parse returns a promise which is fulfilled with the compiled template function.  The
template function takes a single argument "print", which is used as the "print" callback
in the template.

execute is like parse, but you pass it the filename and the print callback. Returns the
same promise, but attaches a callback.  Just a sugar method.

parseStr parses a string of ejs into a string of javascript. It doesn't compile or do
anything funky like that.

Nothing else is supported, because you shouldn't be using ejs for
anything else than a template language.
**/


var posix = require("posix"),
  path = require("path");

exports.parse = function ejs_parse (filename) {
  var cacheKey = filename+"___",
    safeName = path.filename(filename).replace(/[^a-zA-Z0-9_]/g, '_');

  if (exports.useCache && exports.cache.hasOwnProperty(cacheKey)) {
    var p = new process.Promise();
    setTimeout(function () { p.emitSucess(exports.cache[cacheKey]) });
    return p;
  }
  
  return posix.cat(filename).addCallback(function (src) {
    try {
      exports.cache[cacheKey] = process.compile(ejs_parseStr(src, filename), filename);
    } catch (ex) {
      promiseCat.emitError(ex);
    }
  });
};
exports.render = function ejs_render (filename, cb) {
  return exports.parse(filename).addCallback(function (fn) { fn(cb) });
};

exports.useCache = true;
exports.cache = {};

// the state machine
exports.parseStr = ejs_parseStr;
function ejs_parseStr (src, filename) {
  var safeName = path.filename(filename).replace(/[^a-zA-Z0-9_]/g, '_'),
    
    STATE_JS = "STATE_JS",
    STATE_JS_CODE = "STATE_JS_CODE",
    STATE_JS_PRINT = "STATE_JS_PRINT",
    STATE_JS_PRINT_START = "STATE_JS_PRINT_START",
    STATE_HTML = "STATE_HTML",
    
    STATE_NO_STR = "STATE_NO_STR",
    STATE_STR1 = "STATE_STR1",
    STATE_STR2 = "STATE_STR2",
    
    STATE_NO_REGEX = "STATE_NO_REGEX",
    STATE_REGEX = "STATE_REGEX",
    
    escaped = false,
    state = STATE_HTML,
    str_state = STATE_NO_STR,
    reg_state = STATE_NO_REGEX,
    
    CHR_STR1 = "'",
    CHR_STR2 = '"',
    CHR_OPEN = '<',
    CHR_PCT = '%',
    CHR_CLOSE = '>',
    CHR_EQ = '=',
    CHR_ESC = '\\',
    STR_OPEN = "<%",
    STR_PRINT = "<%=",
    STR_CLOSE = "%>",
    
    // the marker of where the STATE_HTML started.
    // that way, we can replace the whole bit with a varname, and then
    // stringify all the raw strings to vars at the beginning.
    marker = 0,
    
    // put enough \n's in front of the raw strings so that the line numbers are consistent.
    cr_count = 0,
    
    // The buffer that stores the HTML when we're in STATE_HTML
    html_buffer = [];
    
    // just split, since arrays are more better for this.
    // we're going to end up with an array of output, and then JSON.stringify()
    // it at the end.
    arr = src.split(""),
    
    // the output buffer, where the code goes as it's parsed.
    out = ["(function parsed_", safeName, " (print) {"];
  
  for ( var i = 0, l = arr.length; i < l; i ++ ) {
    var c = arr[i];
    if (state === STATE_HTML) {
      // check to see if it's time to switch out.
      if (c === CHR_PCT && html_buffer[html_buffer.length - 1] === CHR_OPEN) {
        state = STATE_JS;
        // pop the '<' off the html_buffer, since we don't want to print that
        html_buffer.pop();
        // push the print statement onto the output buffer
        while (cr_count -- > 0) out.push("\n");
        cr_count = 0;
        if (html_buffer.length) {
          out.push(';print(', JSON.stringify(html_buffer.join("")), ');');
        }
        html_buffer = [];
      } else {
        if (c === "\n") {
          cr_count ++;
        }
        html_buffer.push(c);
      }
    } else if ( state === STATE_JS ) {
      // figure out if we want code or print.
      if (c === CHR_EQ) {
        state = STATE_JS_PRINT_START;
      } else {
        state = STATE_JS_CODE;
      }
      // back up a char so that we can process this.
      // that's so that we don't bork on <%%> 
      i --;
    } else if (state === STATE_JS_PRINT_START) {
      // push the print statement onto the buffer.
      out.push("print(");
      state = STATE_JS_PRINT;
    } else {
      // now it gets interesting.
      // we basically just need to watch for a %> that *isn't*
      // in a string or regex.  When that happens, end the print() statement
      // if we're in STATE_JS_PRINT, and flip into STATE_HTML.
      if (str_state === STATE_STR1) {
        if (c === CHR_ESC || escaped) {
          escaped = !escaped;
        } else if ( c === CHR_STR1 ) {
          str_state = STATE_NO_STR;
        }
        out.push(c);
      } else if (str_state === STATE_STR2) {
        if (c === CHR_ESC || escaped) {
          escaped = !escaped;
        } else if ( c === CHR_STR2 ) {
          str_state = STATE_NO_STR;
        }
        out.push(c);
      } else if (reg_state === STATE_REGEX) {
        if (c === CHR_ESC || escaped) {
          escaped = !escaped;
        } else if ( c === CHR_REG ) {
          reg_state = STATE_NO_REGEX;
        }
        out.push(c);
      } else {
        // not in a string or regexp.
        if (c === CHR_CLOSE && out[out.length - 1] === CHR_PCT) {
          out.pop();
          if (state === STATE_JS_PRINT) {
            out.push(');');
          }
          state = STATE_HTML;
          str_state = STATE_NO_STR;
          reg_state = STATE_NO_REGEX;
        } else {
          out.push(c);
        }
      }
    }
  } // end for
  out.push('})');
  return out.join("");
};