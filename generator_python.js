/**
 * @license
 * Copyright 2012 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Helper functions for generating Python for blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Python');

goog.require('Blockly.Generator');
goog.require('Blockly.utils.string');


/**
 * Python code generator.
 * @type {!Blockly.Generator}
 */
Blockly.Python = new Blockly.Generator('Python');

/**
 * List of illegal variable names.
 * This is not intended to be a security feature.  Blockly is 100% client-side,
 * so bypassing this list is trivial.  This is intended to prevent users from
 * accidentally clobbering a built-in object or function.
 * @private
 */
Blockly.Python.addReservedWords(
    // import keyword
    // print(','.join(sorted(keyword.kwlist)))
    // https://docs.python.org/3/reference/lexical_analysis.html#keywords
    // https://docs.python.org/2/reference/lexical_analysis.html#keywords
    'False,None,True,and,as,assert,break,class,continue,def,del,elif,else,' +
    'except,exec,finally,for,from,global,if,import,in,is,lambda,nonlocal,not,' +
    'or,pass,print,raise,return,try,while,with,yield,' +
    // https://docs.python.org/3/library/constants.html
    // https://docs.python.org/2/library/constants.html
    'NotImplemented,Ellipsis,__debug__,quit,exit,copyright,license,credits,' +
    // >>> print(','.join(sorted(dir(__builtins__))))
    // https://docs.python.org/3/library/functions.html
    // https://docs.python.org/2/library/functions.html
    'ArithmeticError,AssertionError,AttributeError,BaseException,' +
    'BlockingIOError,BrokenPipeError,BufferError,BytesWarning,' +
    'ChildProcessError,ConnectionAbortedError,ConnectionError,' +
    'ConnectionRefusedError,ConnectionResetError,DeprecationWarning,EOFError,' +
    'Ellipsis,EnvironmentError,Exception,FileExistsError,FileNotFoundError,' +
    'FloatingPointError,FutureWarning,GeneratorExit,IOError,ImportError,' +
    'ImportWarning,IndentationError,IndexError,InterruptedError,' +
    'IsADirectoryError,KeyError,KeyboardInterrupt,LookupError,MemoryError,' +
    'ModuleNotFoundError,NameError,NotADirectoryError,NotImplemented,' +
    'NotImplementedError,OSError,OverflowError,PendingDeprecationWarning,' +
    'PermissionError,ProcessLookupError,RecursionError,ReferenceError,' +
    'ResourceWarning,RuntimeError,RuntimeWarning,StandardError,' +
    'StopAsyncIteration,StopIteration,SyntaxError,SyntaxWarning,SystemError,' +
    'SystemExit,TabError,TimeoutError,TypeError,UnboundLocalError,' +
    'UnicodeDecodeError,UnicodeEncodeError,UnicodeError,' +
    'UnicodeTranslateError,UnicodeWarning,UserWarning,ValueError,Warning,' +
    'ZeroDivisionError,_,__build_class__,__debug__,__doc__,__import__,' +
    '__loader__,__name__,__package__,__spec__,abs,all,any,apply,ascii,' +
    'basestring,bin,bool,buffer,bytearray,bytes,callable,chr,classmethod,cmp,' +
    'coerce,compile,complex,copyright,credits,delattr,dict,dir,divmod,' +
    'enumerate,eval,exec,execfile,exit,file,filter,float,format,frozenset,' +
    'getattr,globals,hasattr,hash,help,hex,id,input,int,intern,isinstance,' +
    'issubclass,iter,len,license,list,locals,long,map,max,memoryview,min,' +
    'next,object,oct,open,ord,pow,print,property,quit,range,raw_input,reduce,' +
    'reload,repr,reversed,round,set,setattr,slice,sorted,staticmethod,str,' +
    'sum,super,tuple,type,unichr,unicode,vars,xrange,zip'
);

/**
 * Order of operation ENUMs.
 * http://docs.python.org/reference/expressions.html#summary
 */
Blockly.Python.ORDER_ATOMIC = 0;            // 0 "" ...
Blockly.Python.ORDER_COLLECTION = 1;        // tuples, lists, dictionaries
Blockly.Python.ORDER_STRING_CONVERSION = 1; // `expression...`
Blockly.Python.ORDER_MEMBER = 2.1;          // . []
Blockly.Python.ORDER_FUNCTION_CALL = 2.2;   // ()
Blockly.Python.ORDER_EXPONENTIATION = 3;    // **
Blockly.Python.ORDER_UNARY_SIGN = 4;        // + -
Blockly.Python.ORDER_BITWISE_NOT = 4;       // ~
Blockly.Python.ORDER_MULTIPLICATIVE = 5;    // * / // %
Blockly.Python.ORDER_ADDITIVE = 6;          // + -
Blockly.Python.ORDER_BITWISE_SHIFT = 7;     // << >>
Blockly.Python.ORDER_BITWISE_AND = 8;       // &
Blockly.Python.ORDER_BITWISE_XOR = 9;       // ^
Blockly.Python.ORDER_BITWISE_OR = 10;       // |
Blockly.Python.ORDER_RELATIONAL = 11;       // in, not in, is, is not,
                                            //     <, <=, >, >=, <>, !=, ==
Blockly.Python.ORDER_LOGICAL_NOT = 12;      // not
Blockly.Python.ORDER_LOGICAL_AND = 13;      // and
Blockly.Python.ORDER_LOGICAL_OR = 14;       // or
Blockly.Python.ORDER_CONDITIONAL = 15;      // if else
Blockly.Python.ORDER_LAMBDA = 16;           // lambda
Blockly.Python.ORDER_NONE = 99;             // (...)

/**
 * List of outer-inner pairings that do NOT require parentheses.
 * @type {!Array.<!Array.<number>>}
 */
Blockly.Python.ORDER_OVERRIDES = [
  // (foo()).bar -> foo().bar
  // (foo())[0] -> foo()[0]
  [Blockly.Python.ORDER_FUNCTION_CALL, Blockly.Python.ORDER_MEMBER],
  // (foo())() -> foo()()
  [Blockly.Python.ORDER_FUNCTION_CALL, Blockly.Python.ORDER_FUNCTION_CALL],
  // (foo.bar).baz -> foo.bar.baz
  // (foo.bar)[0] -> foo.bar[0]
  // (foo[0]).bar -> foo[0].bar
  // (foo[0])[1] -> foo[0][1]
  [Blockly.Python.ORDER_MEMBER, Blockly.Python.ORDER_MEMBER],
  // (foo.bar)() -> foo.bar()
  // (foo[0])() -> foo[0]()
  [Blockly.Python.ORDER_MEMBER, Blockly.Python.ORDER_FUNCTION_CALL],

  // not (not foo) -> not not foo
  [Blockly.Python.ORDER_LOGICAL_NOT, Blockly.Python.ORDER_LOGICAL_NOT],
  // a and (b and c) -> a and b and c
  [Blockly.Python.ORDER_LOGICAL_AND, Blockly.Python.ORDER_LOGICAL_AND],
  // a or (b or c) -> a or b or c
  [Blockly.Python.ORDER_LOGICAL_OR, Blockly.Python.ORDER_LOGICAL_OR]
];

/**
 * Initialise the database of variable names.
 * @param {!Blockly.Workspace} workspace Workspace to generate code from.
 * @this {Blockly.Generator}
 */
Blockly.Python.init = function(workspace) {
  /**
   * Empty loops or conditionals are not allowed in Python.
   */
  Blockly.Python.PASS = this.INDENT + 'pass\n';
  // Create a dictionary of definitions to be printed before the code.
  Blockly.Python.definitions_ = Object.create(null);
  // Create a dictionary mapping desired function names in definitions_
  // to actual function names (to avoid collisions with user functions).
  Blockly.Python.functionNames_ = Object.create(null);

  if (!Blockly.Python.variableDB_) {
    Blockly.Python.variableDB_ =
        new Blockly.Names(Blockly.Python.RESERVED_WORDS_);
  } else {
    Blockly.Python.variableDB_.reset();
  }

  Blockly.Python.variableDB_.setVariableMap(workspace.getVariableMap());

  var defvars = [];
  // Add developer variables (not created or named by the user).
  var devVarList = Blockly.Variables.allDeveloperVariables(workspace);
  for (var i = 0; i < devVarList.length; i++) {
    defvars.push(Blockly.Python.variableDB_.getName(devVarList[i],
        Blockly.Names.DEVELOPER_VARIABLE_TYPE) + ' = None');
  }

  // Add user variables, but only ones that are being used.
  var variables = Blockly.Variables.allUsedVarModels(workspace);
  for (var i = 0; i < variables.length; i++) {
    defvars.push(Blockly.Python.variableDB_.getName(variables[i].getId(),
        Blockly.VARIABLE_CATEGORY_NAME) + ' = None');
  }

  Blockly.Python.definitions_['variables'] = defvars.join('\n');
};

/**
 * Prepend the generated code with the variable definitions.
 * @param {string} code Generated code.
 * @return {string} Completed code.
 */
Blockly.Python.finish = function(code) {
  // Convert the definitions dictionary into a list.
  var imports = [];
  var definitions = [];
  for (var name in Blockly.Python.definitions_) {
    var def = Blockly.Python.definitions_[name];
    if (def.match(/^(from\s+\S+\s+)?import\s+\S+/)) {
      imports.push(def);
    } else {
      definitions.push(def);
    }
  }
  // Clean up temporary data.
  delete Blockly.Python.definitions_;
  delete Blockly.Python.functionNames_;
  Blockly.Python.variableDB_.reset();
  var allDefs = imports.join('\n') + '\n\n' + definitions.join('\n\n');
  return allDefs.replace(/\n\n+/g, '\n\n').replace(/\n*$/, '\n\n\n') + code;
};

/**
 * Naked values are top-level blocks with outputs that aren't plugged into
 * anything.
 * @param {string} line Line of generated code.
 * @return {string} Legal line of code.
 */
Blockly.Python.scrubNakedValue = function(line) {
  return line + '\n';
};

/**
 * Encode a string as a properly escaped Python string, complete with quotes.
 * @param {string} string Text to encode.
 * @return {string} Python string.
 * @private
 */
Blockly.Python.quote_ = function(string) {
  // Can't use goog.string.quote since % must also be escaped.
  string = string.replace(/\\/g, '\\\\')
                 .replace(/\n/g, '\\\n');

  // Follow the CPython behaviour of repr() for a non-byte string.
  var quote = '\'';
  if (string.indexOf('\'') !== -1) {
    if (string.indexOf('"') === -1) {
      quote = '"';
    } else {
      string = string.replace(/'/g, '\\\'');
    }
  };
  return quote + string + quote;
};

/**
 * Encode a string as a properly escaped multiline Python string, complete
 * with quotes.
 * @param {string} string Text to encode.
 * @return {string} Python string.
 * @private
 */
Blockly.Python.multiline_quote_ = function(string) {
  // Can't use goog.string.quote since % must also be escaped.
  string = string.replace(/'''/g, '\\\'\\\'\\\'');
  return '\'\'\'' + string + '\'\'\'';
};

/**
 * Common tasks for generating Python from blocks.
 * Handles comments for the specified block and any connected value blocks.
 * Calls any statements following this block.
 * @param {!Blockly.Block} block The current block.
 * @param {string} code The Python code created for this block.
 * @param {boolean=} opt_thisOnly True to generate code for only this statement.
 * @return {string} Python code with comments and subsequent blocks added.
 * @private
 */
Blockly.Python.scrub_ = function(block, code, opt_thisOnly) {
  var commentCode = '';
  // Only collect comments for blocks that aren't inline.
  if (!block.outputConnection || !block.outputConnection.targetConnection) {
    // Collect comment for this block.
    var comment = block.getCommentText();
    if (comment) {
      comment = Blockly.utils.string.wrap(comment,
          Blockly.Python.COMMENT_WRAP - 3);
      commentCode += Blockly.Python.prefixLines(comment + '\n', '# ');
    }
    // Collect comments for all value arguments.
    // Don't collect comments for nested statements.
    for (var i = 0; i < block.inputList.length; i++) {
      if (block.inputList[i].type == Blockly.INPUT_VALUE) {
        var childBlock = block.inputList[i].connection.targetBlock();
        if (childBlock) {
          comment = Blockly.Python.allNestedComments(childBlock);
          if (comment) {
            commentCode += Blockly.Python.prefixLines(comment, '# ');
          }
        }
      }
    }
  }
  var nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  var nextCode = opt_thisOnly ? '' : Blockly.Python.blockToCode(nextBlock);
  return commentCode + code + nextCode;
};

/**
 * Gets a property and adjusts the value, taking into account indexing, and
 * casts to an integer.
 * @param {!Blockly.Block} block The block.
 * @param {string} atId The property ID of the element to get.
 * @param {number=} opt_delta Value to add.
 * @param {boolean=} opt_negate Whether to negate the value.
 * @return {string|number}
 */
Blockly.Python.getAdjustedInt = function(block, atId, opt_delta, opt_negate) {
  var delta = opt_delta || 0;
  if (block.workspace.options.oneBasedIndex) {
    delta--;
  }
  var defaultAtIndex = block.workspace.options.oneBasedIndex ? '1' : '0';
  var atOrder = delta ? Blockly.Python.ORDER_ADDITIVE :
      Blockly.Python.ORDER_NONE;
  var at = Blockly.Python.valueToCode(block, atId, atOrder) || defaultAtIndex;

  if (Blockly.isNumber(at)) {
    // If the index is a naked number, adjust it right now.
    at = parseInt(at, 10) + delta;
    if (opt_negate) {
      at = -at;
    }
  } else {
    // If the index is dynamic, adjust it in code.
    if (delta > 0) {
      at = 'int(' + at + ' + ' + delta + ')';
    } else if (delta < 0) {
      at = 'int(' + at + ' - ' + -delta + ')';
    } else {
      at = 'int(' + at + ')';
    }
    if (opt_negate) {
      at = '-' + at;
    }
  }
  return at;
};
/**
 * @license
 * Copyright 2012 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Python for colour blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Python.colour');

goog.require('Blockly.Python');


Blockly.Python['colour_picker'] = function(block) {
  // Colour picker.
  var code = Blockly.Python.quote_(block.getFieldValue('COLOUR'));
  return [code, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python['colour_random'] = function(block) {
  // Generate a random colour.
  Blockly.Python.definitions_['import_random'] = 'import random';
  var code = '\'#%06x\' % random.randint(0, 2**24 - 1)';
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['colour_rgb'] = function(block) {
  // Compose a colour from RGB components expressed as percentages.
  var functionName = Blockly.Python.provideFunction_(
      'colour_rgb',
      ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(r, g, b):',
       '  r = round(min(100, max(0, r)) * 2.55)',
       '  g = round(min(100, max(0, g)) * 2.55)',
       '  b = round(min(100, max(0, b)) * 2.55)',
       '  return \'#%02x%02x%02x\' % (r, g, b)']);
  var r = Blockly.Python.valueToCode(block, 'RED',
                                     Blockly.Python.ORDER_NONE) || 0;
  var g = Blockly.Python.valueToCode(block, 'GREEN',
                                     Blockly.Python.ORDER_NONE) || 0;
  var b = Blockly.Python.valueToCode(block, 'BLUE',
                                     Blockly.Python.ORDER_NONE) || 0;
  var code = functionName + '(' + r + ', ' + g + ', ' + b + ')';
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['colour_blend'] = function(block) {
  // Blend two colours together.
  var functionName = Blockly.Python.provideFunction_(
      'colour_blend',
      ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ +
          '(colour1, colour2, ratio):',
       '  r1, r2 = int(colour1[1:3], 16), int(colour2[1:3], 16)',
       '  g1, g2 = int(colour1[3:5], 16), int(colour2[3:5], 16)',
       '  b1, b2 = int(colour1[5:7], 16), int(colour2[5:7], 16)',
       '  ratio = min(1, max(0, ratio))',
       '  r = round(r1 * (1 - ratio) + r2 * ratio)',
       '  g = round(g1 * (1 - ratio) + g2 * ratio)',
       '  b = round(b1 * (1 - ratio) + b2 * ratio)',
       '  return \'#%02x%02x%02x\' % (r, g, b)']);
  var colour1 = Blockly.Python.valueToCode(block, 'COLOUR1',
      Blockly.Python.ORDER_NONE) || '\'#000000\'';
  var colour2 = Blockly.Python.valueToCode(block, 'COLOUR2',
      Blockly.Python.ORDER_NONE) || '\'#000000\'';
  var ratio = Blockly.Python.valueToCode(block, 'RATIO',
      Blockly.Python.ORDER_NONE) || 0;
  var code = functionName + '(' + colour1 + ', ' + colour2 + ', ' + ratio + ')';
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};
/**
 * @license
 * Copyright 2012 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Python for list blocks.
 * @author q.neutron@gmail.com (Quynh Neutron)
 */
'use strict';

goog.provide('Blockly.Python.lists');

goog.require('Blockly.Python');


Blockly.Python['lists_create_empty'] = function(block) {
  // Create an empty list.
  return ['[]', Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python['lists_create_with'] = function(block) {
  // Create a list with any number of elements of any type.
  var elements = new Array(block.itemCount_);
  for (var i = 0; i < block.itemCount_; i++) {
    elements[i] = Blockly.Python.valueToCode(block, 'ADD' + i,
        Blockly.Python.ORDER_NONE) || 'None';
  }
  var code = '[' + elements.join(', ') + ']';
  return [code, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python['lists_repeat'] = function(block) {
  // Create a list with one element repeated.
  var item = Blockly.Python.valueToCode(block, 'ITEM',
      Blockly.Python.ORDER_NONE) || 'None';
  var times = Blockly.Python.valueToCode(block, 'NUM',
      Blockly.Python.ORDER_MULTIPLICATIVE) || '0';
  var code = '[' + item + '] * ' + times;
  return [code, Blockly.Python.ORDER_MULTIPLICATIVE];
};

Blockly.Python['lists_length'] = function(block) {
  // String or array length.
  var list = Blockly.Python.valueToCode(block, 'VALUE',
      Blockly.Python.ORDER_NONE) || '[]';
  return ['len(' + list + ')', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['lists_isEmpty'] = function(block) {
  // Is the string null or array empty?
  var list = Blockly.Python.valueToCode(block, 'VALUE',
      Blockly.Python.ORDER_NONE) || '[]';
  var code = 'not len(' + list + ')';
  return [code, Blockly.Python.ORDER_LOGICAL_NOT];
};

Blockly.Python['lists_indexOf'] = function(block) {
  // Find an item in the list.
  var item = Blockly.Python.valueToCode(block, 'FIND',
      Blockly.Python.ORDER_NONE) || '[]';
  var list = Blockly.Python.valueToCode(block, 'VALUE',
      Blockly.Python.ORDER_NONE) || '\'\'';
  if (block.workspace.options.oneBasedIndex) {
    var errorIndex = ' 0';
    var firstIndexAdjustment = ' + 1';
    var lastIndexAdjustment = '';
  } else {
    var errorIndex = ' -1';
    var firstIndexAdjustment = '';
    var lastIndexAdjustment = ' - 1';
  }
  if (block.getFieldValue('END') == 'FIRST') {
    var functionName = Blockly.Python.provideFunction_(
        'first_index',
        ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ +
            '(my_list, elem):',
         '  try: index = my_list.index(elem)' + firstIndexAdjustment,
         '  except: index =' + errorIndex,
         '  return index']);
    var code = functionName + '(' + list + ', ' + item + ')';
    return [code, Blockly.Python.ORDER_FUNCTION_CALL];
  }
  var functionName = Blockly.Python.provideFunction_(
      'last_index',
      ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(my_list, elem):',
       '  try: index = len(my_list) - my_list[::-1].index(elem)' +
         lastIndexAdjustment,
       '  except: index =' + errorIndex,
       '  return index']);
  var code = functionName + '(' + list + ', ' + item + ')';
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['lists_getIndex'] = function(block) {
  // Get element at index.
  // Note: Until January 2013 this block did not have MODE or WHERE inputs.
  var mode = block.getFieldValue('MODE') || 'GET';
  var where = block.getFieldValue('WHERE') || 'FROM_START';
  var listOrder = (where == 'RANDOM') ? Blockly.Python.ORDER_NONE :
      Blockly.Python.ORDER_MEMBER;
  var list = Blockly.Python.valueToCode(block, 'VALUE', listOrder) || '[]';

  switch (where) {
    case 'FIRST':
      if (mode == 'GET') {
        var code = list + '[0]';
        return [code, Blockly.Python.ORDER_MEMBER];
      } else if (mode == 'GET_REMOVE') {
        var code = list + '.pop(0)';
        return [code, Blockly.Python.ORDER_FUNCTION_CALL];
      } else if (mode == 'REMOVE') {
        return list + '.pop(0)\n';
      }
      break;
    case 'LAST':
      if (mode == 'GET') {
        var code = list + '[-1]';
        return [code, Blockly.Python.ORDER_MEMBER];
      } else if (mode == 'GET_REMOVE') {
        var code = list + '.pop()';
        return [code, Blockly.Python.ORDER_FUNCTION_CALL];
      } else if (mode == 'REMOVE') {
        return list + '.pop()\n';
      }
      break;
    case 'FROM_START':
      var at = Blockly.Python.getAdjustedInt(block, 'AT');
      if (mode == 'GET') {
        var code = list + '[' + at + ']';
        return [code, Blockly.Python.ORDER_MEMBER];
      } else if (mode == 'GET_REMOVE') {
        var code = list + '.pop(' + at + ')';
        return [code, Blockly.Python.ORDER_FUNCTION_CALL];
      } else if (mode == 'REMOVE') {
        return list + '.pop(' + at + ')\n';
      }
      break;
    case'FROM_END':
      var at = Blockly.Python.getAdjustedInt(block, 'AT', 1, true);
      if (mode == 'GET') {
        var code = list + '[' + at + ']';
        return [code, Blockly.Python.ORDER_MEMBER];
      } else if (mode == 'GET_REMOVE') {
        var code = list + '.pop(' + at + ')';
        return [code, Blockly.Python.ORDER_FUNCTION_CALL];
      } else if (mode == 'REMOVE') {
        return list + '.pop(' + at + ')\n';
      }
      break;
    case 'RANDOM':
      Blockly.Python.definitions_['import_random'] = 'import random';
      if (mode == 'GET') {
        code = 'random.choice(' + list + ')';
        return [code, Blockly.Python.ORDER_FUNCTION_CALL];
      } else {
        var functionName = Blockly.Python.provideFunction_(
            'lists_remove_random_item',
            ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(myList):',
              '  x = int(random.random() * len(myList))',
              '  return myList.pop(x)']);
        code = functionName + '(' + list + ')';
        if (mode == 'GET_REMOVE') {
          return [code, Blockly.Python.ORDER_FUNCTION_CALL];
        } else if (mode == 'REMOVE') {
          return code + '\n';
        }
      }
      break;
  }
  throw Error('Unhandled combination (lists_getIndex).');
};

Blockly.Python['lists_setIndex'] = function(block) {
  // Set element at index.
  // Note: Until February 2013 this block did not have MODE or WHERE inputs.
  var list = Blockly.Python.valueToCode(block, 'LIST',
      Blockly.Python.ORDER_MEMBER) || '[]';
  var mode = block.getFieldValue('MODE') || 'GET';
  var where = block.getFieldValue('WHERE') || 'FROM_START';
  var value = Blockly.Python.valueToCode(block, 'TO',
      Blockly.Python.ORDER_NONE) || 'None';
  // Cache non-trivial values to variables to prevent repeated look-ups.
  // Closure, which accesses and modifies 'list'.
  function cacheList() {
    if (list.match(/^\w+$/)) {
      return '';
    }
    var listVar = Blockly.Python.variableDB_.getDistinctName(
        'tmp_list', Blockly.VARIABLE_CATEGORY_NAME);
    var code = listVar + ' = ' + list + '\n';
    list = listVar;
    return code;
  }

  switch (where) {
    case 'FIRST':
      if (mode == 'SET') {
        return list + '[0] = ' + value + '\n';
      } else if (mode == 'INSERT') {
        return list + '.insert(0, ' + value + ')\n';
      }
      break;
    case 'LAST':
        if (mode == 'SET') {
          return list + '[-1] = ' + value + '\n';
        } else if (mode == 'INSERT') {
          return list + '.append(' + value + ')\n';
        }
      break;
    case 'FROM_START':
      var at = Blockly.Python.getAdjustedInt(block, 'AT');
        if (mode == 'SET') {
          return list + '[' + at + '] = ' + value + '\n';
        } else if (mode == 'INSERT') {
          return list + '.insert(' + at + ', ' + value + ')\n';
        }
      break;
    case 'FROM_END':
      var at = Blockly.Python.getAdjustedInt(block, 'AT', 1, true);
        if (mode == 'SET') {
          return list + '[' + at + '] = ' + value + '\n';
        } else if (mode == 'INSERT') {
          return list + '.insert(' + at + ', ' + value + ')\n';
        }
      break;
    case 'RANDOM':
        Blockly.Python.definitions_['import_random'] = 'import random';
        var code = cacheList();
        var xVar = Blockly.Python.variableDB_.getDistinctName(
            'tmp_x', Blockly.VARIABLE_CATEGORY_NAME);
        code += xVar + ' = int(random.random() * len(' + list + '))\n';
        if (mode == 'SET') {
          code += list + '[' + xVar + '] = ' + value + '\n';
          return code;
        } else if (mode == 'INSERT') {
          code += list + '.insert(' + xVar + ', ' + value + ')\n';
          return code;
        }
      break;
  }
  throw Error('Unhandled combination (lists_setIndex).');
};

Blockly.Python['lists_getSublist'] = function(block) {
  // Get sublist.
  var list = Blockly.Python.valueToCode(block, 'LIST',
      Blockly.Python.ORDER_MEMBER) || '[]';
  var where1 = block.getFieldValue('WHERE1');
  var where2 = block.getFieldValue('WHERE2');
  switch (where1) {
    case 'FROM_START':
      var at1 = Blockly.Python.getAdjustedInt(block, 'AT1');
      if (at1 == '0') {
        at1 = '';
      }
      break;
    case 'FROM_END':
      var at1 = Blockly.Python.getAdjustedInt(block, 'AT1', 1, true);
      break;
    case 'FIRST':
      var at1 = '';
      break;
    default:
      throw Error('Unhandled option (lists_getSublist)');
  }
  switch (where2) {
    case 'FROM_START':
      var at2 = Blockly.Python.getAdjustedInt(block, 'AT2', 1);
      break;
    case 'FROM_END':
      var at2 = Blockly.Python.getAdjustedInt(block, 'AT2', 0, true);
      // Ensure that if the result calculated is 0 that sub-sequence will
      // include all elements as expected.
      if (!Blockly.isNumber(String(at2))) {
        Blockly.Python.definitions_['import_sys'] = 'import sys';
        at2 += ' or sys.maxsize';
      } else if (at2 == '0') {
        at2 = '';
      }
      break;
    case 'LAST':
      var at2 = '';
      break;
    default:
      throw Error('Unhandled option (lists_getSublist)');
  }
  var code = list + '[' + at1 + ' : ' + at2 + ']';
  return [code, Blockly.Python.ORDER_MEMBER];
};

Blockly.Python['lists_sort'] = function(block) {
  // Block for sorting a list.
  var list = (Blockly.Python.valueToCode(block, 'LIST',
      Blockly.Python.ORDER_NONE) || '[]');
  var type = block.getFieldValue('TYPE');
  var reverse = block.getFieldValue('DIRECTION') === '1' ? 'False' : 'True';
  var sortFunctionName = Blockly.Python.provideFunction_('lists_sort',
  ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ +
      '(my_list, type, reverse):',
    '  def try_float(s):',
    '    try:',
    '      return float(s)',
    '    except:',
    '      return 0',
    '  key_funcs = {',
    '    "NUMERIC": try_float,',
    '    "TEXT": str,',
    '    "IGNORE_CASE": lambda s: str(s).lower()',
    '  }',
    '  key_func = key_funcs[type]',
    '  list_cpy = list(my_list)', // Clone the list.
    '  return sorted(list_cpy, key=key_func, reverse=reverse)'
  ]);

  var code = sortFunctionName +
      '(' + list + ', "' + type + '", ' + reverse + ')';
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['lists_split'] = function(block) {
  // Block for splitting text into a list, or joining a list into text.
  var mode = block.getFieldValue('MODE');
  if (mode == 'SPLIT') {
    var value_input = Blockly.Python.valueToCode(block, 'INPUT',
        Blockly.Python.ORDER_MEMBER) || '\'\'';
    var value_delim = Blockly.Python.valueToCode(block, 'DELIM',
        Blockly.Python.ORDER_NONE);
    var code = value_input + '.split(' + value_delim + ')';
  } else if (mode == 'JOIN') {
    var value_input = Blockly.Python.valueToCode(block, 'INPUT',
        Blockly.Python.ORDER_NONE) || '[]';
    var value_delim = Blockly.Python.valueToCode(block, 'DELIM',
        Blockly.Python.ORDER_MEMBER) || '\'\'';
    var code = value_delim + '.join(' + value_input + ')';
  } else {
    throw Error('Unknown mode: ' + mode);
  }
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['lists_reverse'] = function(block) {
  // Block for reversing a list.
  var list = Blockly.Python.valueToCode(block, 'LIST',
      Blockly.Python.ORDER_NONE) || '[]';
  var code = 'list(reversed(' + list + '))';
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};
/**
 * @license
 * Copyright 2012 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Python for logic blocks.
 * @author q.neutron@gmail.com (Quynh Neutron)
 */
'use strict';

goog.provide('Blockly.Python.logic');

goog.require('Blockly.Python');


Blockly.Python['controls_if'] = function(block) {
  // If/elseif/else condition.
  var n = 0;
  var code = '', branchCode, conditionCode;
  if (Blockly.Python.STATEMENT_PREFIX) {
    // Automatic prefix insertion is switched off for this block.  Add manually.
    code += Blockly.Python.injectId(Blockly.Python.STATEMENT_PREFIX, block);
  }
  do {
    conditionCode = Blockly.Python.valueToCode(block, 'IF' + n,
        Blockly.Python.ORDER_NONE) || 'False';
    branchCode = Blockly.Python.statementToCode(block, 'DO' + n) ||
        Blockly.Python.PASS;
    if (Blockly.Python.STATEMENT_SUFFIX) {
      branchCode = Blockly.Python.prefixLines(
          Blockly.Python.injectId(Blockly.Python.STATEMENT_SUFFIX, block),
          Blockly.Python.INDENT) + branchCode;
    }
    code += (n == 0 ? 'if ' : 'elif ' ) + conditionCode + ':\n' + branchCode;
    ++n;
  } while (block.getInput('IF' + n));

  if (block.getInput('ELSE') || Blockly.Python.STATEMENT_SUFFIX) {
    branchCode = Blockly.Python.statementToCode(block, 'ELSE') ||
        Blockly.Python.PASS;
    if (Blockly.Python.STATEMENT_SUFFIX) {
      branchCode = Blockly.Python.prefixLines(
          Blockly.Python.injectId(Blockly.Python.STATEMENT_SUFFIX, block),
          Blockly.Python.INDENT) + branchCode;
    }
    code += 'else:\n' + branchCode;
  }
  return code;
};

Blockly.Python['controls_ifelse'] = Blockly.Python['controls_if'];

Blockly.Python['logic_compare'] = function(block) {
  // Comparison operator.
  var OPERATORS = {
    'EQ': '==',
    'NEQ': '!=',
    'LT': '<',
    'LTE': '<=',
    'GT': '>',
    'GTE': '>='
  };
  var operator = OPERATORS[block.getFieldValue('OP')];
  var order = Blockly.Python.ORDER_RELATIONAL;
  var argument0 = Blockly.Python.valueToCode(block, 'A', order) || '0';
  var argument1 = Blockly.Python.valueToCode(block, 'B', order) || '0';
  var code = argument0 + ' ' + operator + ' ' + argument1;
  return [code, order];
};

Blockly.Python['logic_operation'] = function(block) {
  // Operations 'and', 'or'.
  var operator = (block.getFieldValue('OP') == 'AND') ? 'and' : 'or';
  var order = (operator == 'and') ? Blockly.Python.ORDER_LOGICAL_AND :
      Blockly.Python.ORDER_LOGICAL_OR;
  var argument0 = Blockly.Python.valueToCode(block, 'A', order);
  var argument1 = Blockly.Python.valueToCode(block, 'B', order);
  if (!argument0 && !argument1) {
    // If there are no arguments, then the return value is false.
    argument0 = 'False';
    argument1 = 'False';
  } else {
    // Single missing arguments have no effect on the return value.
    var defaultArgument = (operator == 'and') ? 'True' : 'False';
    if (!argument0) {
      argument0 = defaultArgument;
    }
    if (!argument1) {
      argument1 = defaultArgument;
    }
  }
  var code = argument0 + ' ' + operator + ' ' + argument1;
  return [code, order];
};

Blockly.Python['logic_negate'] = function(block) {
  // Negation.
  var argument0 = Blockly.Python.valueToCode(block, 'BOOL',
      Blockly.Python.ORDER_LOGICAL_NOT) || 'True';
  var code = 'not ' + argument0;
  return [code, Blockly.Python.ORDER_LOGICAL_NOT];
};

Blockly.Python['logic_boolean'] = function(block) {
  // Boolean values true and false.
  var code = (block.getFieldValue('BOOL') == 'TRUE') ? 'True' : 'False';
  return [code, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python['logic_null'] = function(block) {
  // Null data type.
  return ['None', Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python['logic_ternary'] = function(block) {
  // Ternary operator.
  var value_if = Blockly.Python.valueToCode(block, 'IF',
      Blockly.Python.ORDER_CONDITIONAL) || 'False';
  var value_then = Blockly.Python.valueToCode(block, 'THEN',
      Blockly.Python.ORDER_CONDITIONAL) || 'None';
  var value_else = Blockly.Python.valueToCode(block, 'ELSE',
      Blockly.Python.ORDER_CONDITIONAL) || 'None';
  var code = value_then + ' if ' + value_if + ' else ' + value_else;
  return [code, Blockly.Python.ORDER_CONDITIONAL];
};
/**
 * @license
 * Copyright 2012 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Python for loop blocks.
 * @author q.neutron@gmail.com (Quynh Neutron)
 */
'use strict';

goog.provide('Blockly.Python.loops');

goog.require('Blockly.Python');


Blockly.Python['controls_repeat_ext'] = function(block) {
  // Repeat n times.
  if (block.getField('TIMES')) {
    // Internal number.
    var repeats = String(parseInt(block.getFieldValue('TIMES'), 10));
  } else {
    // External number.
    var repeats = Blockly.Python.valueToCode(block, 'TIMES',
        Blockly.Python.ORDER_NONE) || '0';
  }
  if (Blockly.isNumber(repeats)) {
    repeats = parseInt(repeats, 10);
  } else {
    repeats = 'int(' + repeats + ')';
  }
  var branch = Blockly.Python.statementToCode(block, 'DO');
  branch = Blockly.Python.addLoopTrap(branch, block) || Blockly.Python.PASS;
  var loopVar = Blockly.Python.variableDB_.getDistinctName(
      'count', Blockly.VARIABLE_CATEGORY_NAME);
  var code = 'for ' + loopVar + ' in range(' + repeats + '):\n' + branch;
  return code;
};

Blockly.Python['controls_repeat'] = Blockly.Python['controls_repeat_ext'];

Blockly.Python['controls_whileUntil'] = function(block) {
  // Do while/until loop.
  var until = block.getFieldValue('MODE') == 'UNTIL';
  var argument0 = Blockly.Python.valueToCode(block, 'BOOL',
      until ? Blockly.Python.ORDER_LOGICAL_NOT :
      Blockly.Python.ORDER_NONE) || 'False';
  var branch = Blockly.Python.statementToCode(block, 'DO');
  branch = Blockly.Python.addLoopTrap(branch, block) || Blockly.Python.PASS;
  if (until) {
    argument0 = 'not ' + argument0;
  }
  return 'while ' + argument0 + ':\n' + branch;
};

Blockly.Python['controls_for'] = function(block) {
  // For loop.
  var variable0 = Blockly.Python.variableDB_.getName(
      block.getFieldValue('VAR'), Blockly.VARIABLE_CATEGORY_NAME);
  var argument0 = Blockly.Python.valueToCode(block, 'FROM',
      Blockly.Python.ORDER_NONE) || '0';
  var argument1 = Blockly.Python.valueToCode(block, 'TO',
      Blockly.Python.ORDER_NONE) || '0';
  var increment = Blockly.Python.valueToCode(block, 'BY',
      Blockly.Python.ORDER_NONE) || '1';
  var branch = Blockly.Python.statementToCode(block, 'DO');
  branch = Blockly.Python.addLoopTrap(branch, block) || Blockly.Python.PASS;

  var code = '';
  var range;

  // Helper functions.
  var defineUpRange = function() {
    return Blockly.Python.provideFunction_(
        'upRange',
        ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ +
            '(start, stop, step):',
         '  while start <= stop:',
         '    yield start',
         '    start += abs(step)']);
  };
  var defineDownRange = function() {
    return Blockly.Python.provideFunction_(
        'downRange',
        ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ +
            '(start, stop, step):',
         '  while start >= stop:',
         '    yield start',
         '    start -= abs(step)']);
  };
  // Arguments are legal Python code (numbers or strings returned by scrub()).
  var generateUpDownRange = function(start, end, inc) {
    return '(' + start + ' <= ' + end + ') and ' +
        defineUpRange() + '(' + start + ', ' + end + ', ' + inc + ') or ' +
        defineDownRange() + '(' + start + ', ' + end + ', ' + inc + ')';
  };

  if (Blockly.isNumber(argument0) && Blockly.isNumber(argument1) &&
      Blockly.isNumber(increment)) {
    // All parameters are simple numbers.
    argument0 = Number(argument0);
    argument1 = Number(argument1);
    increment = Math.abs(Number(increment));
    if (argument0 % 1 === 0 && argument1 % 1 === 0 && increment % 1 === 0) {
      // All parameters are integers.
      if (argument0 <= argument1) {
        // Count up.
        argument1++;
        if (argument0 == 0 && increment == 1) {
          // If starting index is 0, omit it.
          range = argument1;
        } else {
          range = argument0 + ', ' + argument1;
        }
        // If increment isn't 1, it must be explicit.
        if (increment != 1) {
          range += ', ' + increment;
        }
      } else {
        // Count down.
        argument1--;
        range = argument0 + ', ' + argument1 + ', -' + increment;
      }
      range = 'range(' + range + ')';
    } else {
      // At least one of the parameters is not an integer.
      if (argument0 < argument1) {
        range = defineUpRange();
      } else {
        range = defineDownRange();
      }
      range += '(' + argument0 + ', ' + argument1 + ', ' + increment + ')';
    }
  } else {
    // Cache non-trivial values to variables to prevent repeated look-ups.
    var scrub = function(arg, suffix) {
      if (Blockly.isNumber(arg)) {
        // Simple number.
        arg = Number(arg);
      } else if (arg.match(/^\w+$/)) {
        // Variable.
        arg = 'float(' + arg + ')';
      } else {
        // It's complicated.
        var varName = Blockly.Python.variableDB_.getDistinctName(
            variable0 + suffix, Blockly.VARIABLE_CATEGORY_NAME);
        code += varName + ' = float(' + arg + ')\n';
        arg = varName;
      }
      return arg;
    };
    var startVar = scrub(argument0, '_start');
    var endVar = scrub(argument1, '_end');
    var incVar = scrub(increment, '_inc');

    if (typeof startVar == 'number' && typeof endVar == 'number') {
      if (startVar < endVar) {
        range = defineUpRange(startVar, endVar, increment);
      } else {
        range = defineDownRange(startVar, endVar, increment);
      }
    } else {
      // We cannot determine direction statically.
      range = generateUpDownRange(startVar, endVar, increment);
    }
  }
  code += 'for ' + variable0 + ' in ' + range + ':\n' + branch;
  return code;
};

Blockly.Python['controls_forEach'] = function(block) {
  // For each loop.
  var variable0 = Blockly.Python.variableDB_.getName(
      block.getFieldValue('VAR'), Blockly.VARIABLE_CATEGORY_NAME);
  var argument0 = Blockly.Python.valueToCode(block, 'LIST',
      Blockly.Python.ORDER_RELATIONAL) || '[]';
  var branch = Blockly.Python.statementToCode(block, 'DO');
  branch = Blockly.Python.addLoopTrap(branch, block) || Blockly.Python.PASS;
  var code = 'for ' + variable0 + ' in ' + argument0 + ':\n' + branch;
  return code;
};

Blockly.Python['controls_flow_statements'] = function(block) {
  // Flow statements: continue, break.
  var xfix = '';
  if (Blockly.Python.STATEMENT_PREFIX) {
    // Automatic prefix insertion is switched off for this block.  Add manually.
    xfix += Blockly.Python.injectId(Blockly.Python.STATEMENT_PREFIX, block);
  }
  if (Blockly.Python.STATEMENT_SUFFIX) {
    // Inject any statement suffix here since the regular one at the end
    // will not get executed if the break/continue is triggered.
    xfix += Blockly.Python.injectId(Blockly.Python.STATEMENT_SUFFIX, block);
  }
  if (Blockly.Python.STATEMENT_PREFIX) {
    var loop = Blockly.Constants.Loops
        .CONTROL_FLOW_IN_LOOP_CHECK_MIXIN.getSurroundLoop(block);
    if (loop && !loop.suppressPrefixSuffix) {
      // Inject loop's statement prefix here since the regular one at the end
      // of the loop will not get executed if 'continue' is triggered.
      // In the case of 'break', a prefix is needed due to the loop's suffix.
      xfix += Blockly.Python.injectId(Blockly.Python.STATEMENT_PREFIX, loop);
    }
  }
  switch (block.getFieldValue('FLOW')) {
    case 'BREAK':
      return xfix + 'break\n';
    case 'CONTINUE':
      return xfix + 'continue\n';
  }
  throw Error('Unknown flow statement.');
};
/**
 * @license
 * Copyright 2012 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Python for math blocks.
 * @author q.neutron@gmail.com (Quynh Neutron)
 */
'use strict';

goog.provide('Blockly.Python.math');

goog.require('Blockly.Python');


// If any new block imports any library, add that library name here.
Blockly.Python.addReservedWords('math,random,Number');

Blockly.Python['math_number'] = function(block) {
  // Numeric value.
  var code = Number(block.getFieldValue('NUM'));
  var order;
  if (code == Infinity) {
    code = 'float("inf")';
    order = Blockly.Python.ORDER_FUNCTION_CALL;
  } else if (code == -Infinity) {
    code = '-float("inf")';
    order = Blockly.Python.ORDER_UNARY_SIGN;
  } else {
    order = code < 0 ? Blockly.Python.ORDER_UNARY_SIGN :
            Blockly.Python.ORDER_ATOMIC;
  }
  return [code, order];
};

Blockly.Python['math_arithmetic'] = function(block) {
  // Basic arithmetic operators, and power.
  var OPERATORS = {
    'ADD': [' + ', Blockly.Python.ORDER_ADDITIVE],
    'MINUS': [' - ', Blockly.Python.ORDER_ADDITIVE],
    'MULTIPLY': [' * ', Blockly.Python.ORDER_MULTIPLICATIVE],
    'DIVIDE': [' / ', Blockly.Python.ORDER_MULTIPLICATIVE],
    'POWER': [' ** ', Blockly.Python.ORDER_EXPONENTIATION]
  };
  var tuple = OPERATORS[block.getFieldValue('OP')];
  var operator = tuple[0];
  var order = tuple[1];
  var argument0 = Blockly.Python.valueToCode(block, 'A', order) || '0';
  var argument1 = Blockly.Python.valueToCode(block, 'B', order) || '0';
  var code = argument0 + operator + argument1;
  return [code, order];
  // In case of 'DIVIDE', division between integers returns different results
  // in Python 2 and 3. However, is not an issue since Blockly does not
  // guarantee identical results in all languages.  To do otherwise would
  // require every operator to be wrapped in a function call.  This would kill
  // legibility of the generated code.
};

Blockly.Python['math_single'] = function(block) {
  // Math operators with single operand.
  var operator = block.getFieldValue('OP');
  var code;
  var arg;
  if (operator == 'NEG') {
    // Negation is a special case given its different operator precedence.
    code = Blockly.Python.valueToCode(block, 'NUM',
        Blockly.Python.ORDER_UNARY_SIGN) || '0';
    return ['-' + code, Blockly.Python.ORDER_UNARY_SIGN];
  }
  Blockly.Python.definitions_['import_math'] = 'import math';
  if (operator == 'SIN' || operator == 'COS' || operator == 'TAN') {
    arg = Blockly.Python.valueToCode(block, 'NUM',
        Blockly.Python.ORDER_MULTIPLICATIVE) || '0';
  } else {
    arg = Blockly.Python.valueToCode(block, 'NUM',
        Blockly.Python.ORDER_NONE) || '0';
  }
  // First, handle cases which generate values that don't need parentheses
  // wrapping the code.
  switch (operator) {
    case 'ABS':
      code = 'math.fabs(' + arg + ')';
      break;
    case 'ROOT':
      code = 'math.sqrt(' + arg + ')';
      break;
    case 'LN':
      code = 'math.log(' + arg + ')';
      break;
    case 'LOG10':
      code = 'math.log10(' + arg + ')';
      break;
    case 'EXP':
      code = 'math.exp(' + arg + ')';
      break;
    case 'POW10':
      code = 'math.pow(10,' + arg + ')';
      break;
    case 'ROUND':
      code = 'round(' + arg + ')';
      break;
    case 'ROUNDUP':
      code = 'math.ceil(' + arg + ')';
      break;
    case 'ROUNDDOWN':
      code = 'math.floor(' + arg + ')';
      break;
    case 'SIN':
      code = 'math.sin(' + arg + ' / 180.0 * math.pi)';
      break;
    case 'COS':
      code = 'math.cos(' + arg + ' / 180.0 * math.pi)';
      break;
    case 'TAN':
      code = 'math.tan(' + arg + ' / 180.0 * math.pi)';
      break;
  }
  if (code) {
    return [code, Blockly.Python.ORDER_FUNCTION_CALL];
  }
  // Second, handle cases which generate values that may need parentheses
  // wrapping the code.
  switch (operator) {
    case 'ASIN':
      code = 'math.asin(' + arg + ') / math.pi * 180';
      break;
    case 'ACOS':
      code = 'math.acos(' + arg + ') / math.pi * 180';
      break;
    case 'ATAN':
      code = 'math.atan(' + arg + ') / math.pi * 180';
      break;
    default:
      throw Error('Unknown math operator: ' + operator);
  }
  return [code, Blockly.Python.ORDER_MULTIPLICATIVE];
};

Blockly.Python['math_constant'] = function(block) {
  // Constants: PI, E, the Golden Ratio, sqrt(2), 1/sqrt(2), INFINITY.
  var CONSTANTS = {
    'PI': ['math.pi', Blockly.Python.ORDER_MEMBER],
    'E': ['math.e', Blockly.Python.ORDER_MEMBER],
    'GOLDEN_RATIO': ['(1 + math.sqrt(5)) / 2',
                     Blockly.Python.ORDER_MULTIPLICATIVE],
    'SQRT2': ['math.sqrt(2)', Blockly.Python.ORDER_MEMBER],
    'SQRT1_2': ['math.sqrt(1.0 / 2)', Blockly.Python.ORDER_MEMBER],
    'INFINITY': ['float(\'inf\')', Blockly.Python.ORDER_ATOMIC]
  };
  var constant = block.getFieldValue('CONSTANT');
  if (constant != 'INFINITY') {
    Blockly.Python.definitions_['import_math'] = 'import math';
  }
  return CONSTANTS[constant];
};

Blockly.Python['math_number_property'] = function(block) {
  // Check if a number is even, odd, prime, whole, positive, or negative
  // or if it is divisible by certain number. Returns true or false.
  var number_to_check = Blockly.Python.valueToCode(block, 'NUMBER_TO_CHECK',
      Blockly.Python.ORDER_MULTIPLICATIVE) || '0';
  var dropdown_property = block.getFieldValue('PROPERTY');
  var code;
  if (dropdown_property == 'PRIME') {
    Blockly.Python.definitions_['import_math'] = 'import math';
    Blockly.Python.definitions_['from_numbers_import_Number'] =
        'from numbers import Number';
    var functionName = Blockly.Python.provideFunction_(
        'math_isPrime',
        ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(n):',
         '  # https://en.wikipedia.org/wiki/Primality_test#Naive_methods',
         '  # If n is not a number but a string, try parsing it.',
         '  if not isinstance(n, Number):',
         '    try:',
         '      n = float(n)',
         '    except:',
         '      return False',
         '  if n == 2 or n == 3:',
         '    return True',
         '  # False if n is negative, is 1, or not whole,' +
             ' or if n is divisible by 2 or 3.',
         '  if n <= 1 or n % 1 != 0 or n % 2 == 0 or n % 3 == 0:',
         '    return False',
         '  # Check all the numbers of form 6k +/- 1, up to sqrt(n).',
         '  for x in range(6, int(math.sqrt(n)) + 2, 6):',
         '    if n % (x - 1) == 0 or n % (x + 1) == 0:',
         '      return False',
         '  return True']);
    code = functionName + '(' + number_to_check + ')';
    return [code, Blockly.Python.ORDER_FUNCTION_CALL];
  }
  switch (dropdown_property) {
    case 'EVEN':
      code = number_to_check + ' % 2 == 0';
      break;
    case 'ODD':
      code = number_to_check + ' % 2 == 1';
      break;
    case 'WHOLE':
      code = number_to_check + ' % 1 == 0';
      break;
    case 'POSITIVE':
      code = number_to_check + ' > 0';
      break;
    case 'NEGATIVE':
      code = number_to_check + ' < 0';
      break;
    case 'DIVISIBLE_BY':
      var divisor = Blockly.Python.valueToCode(block, 'DIVISOR',
          Blockly.Python.ORDER_MULTIPLICATIVE);
      // If 'divisor' is some code that evals to 0, Python will raise an error.
      if (!divisor || divisor == '0') {
        return ['False', Blockly.Python.ORDER_ATOMIC];
      }
      code = number_to_check + ' % ' + divisor + ' == 0';
      break;
  }
  return [code, Blockly.Python.ORDER_RELATIONAL];
};

Blockly.Python['math_change'] = function(block) {
  // Add to a variable in place.
  Blockly.Python.definitions_['from_numbers_import_Number'] =
      'from numbers import Number';
  var argument0 = Blockly.Python.valueToCode(block, 'DELTA',
      Blockly.Python.ORDER_ADDITIVE) || '0';
  var varName = Blockly.Python.variableDB_.getName(block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME);
  return varName + ' = (' + varName + ' if isinstance(' + varName +
      ', Number) else 0) + ' + argument0 + '\n';
};

// Rounding functions have a single operand.
Blockly.Python['math_round'] = Blockly.Python['math_single'];
// Trigonometry functions have a single operand.
Blockly.Python['math_trig'] = Blockly.Python['math_single'];

Blockly.Python['math_on_list'] = function(block) {
  // Math functions for lists.
  var func = block.getFieldValue('OP');
  var list = Blockly.Python.valueToCode(block, 'LIST',
      Blockly.Python.ORDER_NONE) || '[]';
  var code;
  switch (func) {
    case 'SUM':
      code = 'sum(' + list + ')';
      break;
    case 'MIN':
      code = 'min(' + list + ')';
      break;
    case 'MAX':
      code = 'max(' + list + ')';
      break;
    case 'AVERAGE':
      Blockly.Python.definitions_['from_numbers_import_Number'] =
          'from numbers import Number';
      var functionName = Blockly.Python.provideFunction_(
          'math_mean',
          // This operation excludes null and values that aren't int or float:',
          // math_mean([null, null, "aString", 1, 9]) == 5.0.',
          ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(myList):',
           '  localList = [e for e in myList if isinstance(e, Number)]',
           '  if not localList: return',
           '  return float(sum(localList)) / len(localList)']);
      code = functionName + '(' + list + ')';
      break;
    case 'MEDIAN':
      Blockly.Python.definitions_['from_numbers_import_Number'] =
          'from numbers import Number';
      var functionName = Blockly.Python.provideFunction_(
          'math_median',
          // This operation excludes null values:
          // math_median([null, null, 1, 3]) == 2.0.
          ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(myList):',
           '  localList = sorted([e for e in myList if isinstance(e, Number)])',
           '  if not localList: return',
           '  if len(localList) % 2 == 0:',
           '    return (localList[len(localList) // 2 - 1] + ' +
               'localList[len(localList) // 2]) / 2.0',
           '  else:',
           '    return localList[(len(localList) - 1) // 2]']);
      code = functionName + '(' + list + ')';
      break;
    case 'MODE':
      var functionName = Blockly.Python.provideFunction_(
          'math_modes',
          // As a list of numbers can contain more than one mode,
          // the returned result is provided as an array.
          // Mode of [3, 'x', 'x', 1, 1, 2, '3'] -> ['x', 1].
          ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(some_list):',
           '  modes = []',
           '  # Using a lists of [item, count] to keep count rather than dict',
           '  # to avoid "unhashable" errors when the counted item is ' +
               'itself a list or dict.',
           '  counts = []',
           '  maxCount = 1',
           '  for item in some_list:',
           '    found = False',
           '    for count in counts:',
           '      if count[0] == item:',
           '        count[1] += 1',
           '        maxCount = max(maxCount, count[1])',
           '        found = True',
           '    if not found:',
           '      counts.append([item, 1])',
           '  for counted_item, item_count in counts:',
           '    if item_count == maxCount:',
           '      modes.append(counted_item)',
           '  return modes']);
      code = functionName + '(' + list + ')';
      break;
    case 'STD_DEV':
      Blockly.Python.definitions_['import_math'] = 'import math';
      var functionName = Blockly.Python.provideFunction_(
          'math_standard_deviation',
          ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(numbers):',
           '  n = len(numbers)',
           '  if n == 0: return',
           '  mean = float(sum(numbers)) / n',
           '  variance = sum((x - mean) ** 2 for x in numbers) / n',
           '  return math.sqrt(variance)']);
      code = functionName + '(' + list + ')';
      break;
    case 'RANDOM':
      Blockly.Python.definitions_['import_random'] = 'import random';
      code = 'random.choice(' + list + ')';
      break;
    default:
      throw Error('Unknown operator: ' + func);
  }
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_modulo'] = function(block) {
  // Remainder computation.
  var argument0 = Blockly.Python.valueToCode(block, 'DIVIDEND',
      Blockly.Python.ORDER_MULTIPLICATIVE) || '0';
  var argument1 = Blockly.Python.valueToCode(block, 'DIVISOR',
      Blockly.Python.ORDER_MULTIPLICATIVE) || '0';
  var code = argument0 + ' % ' + argument1;
  return [code, Blockly.Python.ORDER_MULTIPLICATIVE];
};

Blockly.Python['math_constrain'] = function(block) {
  // Constrain a number between two limits.
  var argument0 = Blockly.Python.valueToCode(block, 'VALUE',
      Blockly.Python.ORDER_NONE) || '0';
  var argument1 = Blockly.Python.valueToCode(block, 'LOW',
      Blockly.Python.ORDER_NONE) || '0';
  var argument2 = Blockly.Python.valueToCode(block, 'HIGH',
      Blockly.Python.ORDER_NONE) || 'float(\'inf\')';
  var code = 'min(max(' + argument0 + ', ' + argument1 + '), ' +
      argument2 + ')';
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_random_int'] = function(block) {
  // Random integer between [X] and [Y].
  Blockly.Python.definitions_['import_random'] = 'import random';
  var argument0 = Blockly.Python.valueToCode(block, 'FROM',
      Blockly.Python.ORDER_NONE) || '0';
  var argument1 = Blockly.Python.valueToCode(block, 'TO',
      Blockly.Python.ORDER_NONE) || '0';
  var code = 'random.randint(' + argument0 + ', ' + argument1 + ')';
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_random_float'] = function(block) {
  // Random fraction between 0 and 1.
  Blockly.Python.definitions_['import_random'] = 'import random';
  return ['random.random()', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['math_atan2'] = function(block) {
  // Arctangent of point (X, Y) in degrees from -180 to 180.
  Blockly.Python.definitions_['import_math'] = 'import math';
  var argument0 = Blockly.Python.valueToCode(block, 'X',
      Blockly.Python.ORDER_NONE) || '0';
  var argument1 = Blockly.Python.valueToCode(block, 'Y',
      Blockly.Python.ORDER_NONE) || '0';
  return ['math.atan2(' + argument1 + ', ' + argument0 + ') / math.pi * 180',
      Blockly.Python.ORDER_MULTIPLICATIVE];
};
/**
 * @license
 * Copyright 2012 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Python for procedure blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Python.procedures');

goog.require('Blockly.Python');


Blockly.Python['procedures_defreturn'] = function(block) {
  // Define a procedure with a return value.
  // First, add a 'global' statement for every variable that is not shadowed by
  // a local parameter.
  var globals = [];
  var varName;
  var workspace = block.workspace;
  var variables = Blockly.Variables.allUsedVarModels(workspace) || [];
  for (var i = 0, variable; variable = variables[i]; i++) {
    varName = variable.name;
    if (block.arguments_.indexOf(varName) == -1) {
      globals.push(Blockly.Python.variableDB_.getName(varName,
          Blockly.VARIABLE_CATEGORY_NAME));
    }
  }
  // Add developer variables.
  var devVarList = Blockly.Variables.allDeveloperVariables(workspace);
  for (var i = 0; i < devVarList.length; i++) {
    globals.push(Blockly.Python.variableDB_.getName(devVarList[i],
        Blockly.Names.DEVELOPER_VARIABLE_TYPE));
  }

  globals = globals.length ?
      Blockly.Python.INDENT + 'global ' + globals.join(', ') + '\n' : '';
  var funcName = Blockly.Python.variableDB_.getName(
      block.getFieldValue('NAME'), Blockly.PROCEDURE_CATEGORY_NAME);
  var xfix1 = '';
  if (Blockly.Python.STATEMENT_PREFIX) {
    xfix1 += Blockly.Python.injectId(Blockly.Python.STATEMENT_PREFIX, block);
  }
  if (Blockly.Python.STATEMENT_SUFFIX) {
    xfix1 += Blockly.Python.injectId(Blockly.Python.STATEMENT_SUFFIX, block);
  }
  if (xfix1) {
    xfix1 = Blockly.Python.prefixLines(xfix1, Blockly.Python.INDENT);
  }
  var loopTrap = '';
  if (Blockly.Python.INFINITE_LOOP_TRAP) {
    loopTrap = Blockly.Python.prefixLines(
        Blockly.Python.injectId(Blockly.Python.INFINITE_LOOP_TRAP, block),
        Blockly.Python.INDENT);
  }
  var branch = Blockly.Python.statementToCode(block, 'STACK');
  var returnValue = Blockly.Python.valueToCode(block, 'RETURN',
      Blockly.Python.ORDER_NONE) || '';
  var xfix2 = '';
  if (branch && returnValue) {
    // After executing the function body, revisit this block for the return.
    xfix2 = xfix1;
  }
  if (returnValue) {
    returnValue = Blockly.Python.INDENT + 'return ' + returnValue + '\n';
  } else if (!branch) {
    branch = Blockly.Python.PASS;
  }
  var args = [];
  for (var i = 0; i < block.arguments_.length; i++) {
    args[i] = Blockly.Python.variableDB_.getName(block.arguments_[i],
        Blockly.VARIABLE_CATEGORY_NAME);
  }
  var code = 'def ' + funcName + '(' + args.join(', ') + '):\n' +
      globals + xfix1 + loopTrap + branch + xfix2 + returnValue;
  code = Blockly.Python.scrub_(block, code);
  // Add % so as not to collide with helper functions in definitions list.
  Blockly.Python.definitions_['%' + funcName] = code;
  return null;
};

// Defining a procedure without a return value uses the same generator as
// a procedure with a return value.
Blockly.Python['procedures_defnoreturn'] =
    Blockly.Python['procedures_defreturn'];

Blockly.Python['procedures_callreturn'] = function(block) {
  // Call a procedure with a return value.
  var funcName = Blockly.Python.variableDB_.getName(block.getFieldValue('NAME'),
      Blockly.PROCEDURE_CATEGORY_NAME);
  var args = [];
  for (var i = 0; i < block.arguments_.length; i++) {
    args[i] = Blockly.Python.valueToCode(block, 'ARG' + i,
        Blockly.Python.ORDER_NONE) || 'None';
  }
  var code = funcName + '(' + args.join(', ') + ')';
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['procedures_callnoreturn'] = function(block) {
  // Call a procedure with no return value.
  // Generated code is for a function call as a statement is the same as a
  // function call as a value, with the addition of line ending.
  var tuple = Blockly.Python['procedures_callreturn'](block);
  return tuple[0] + '\n';
};

Blockly.Python['procedures_ifreturn'] = function(block) {
  // Conditionally return value from a procedure.
  var condition = Blockly.Python.valueToCode(block, 'CONDITION',
      Blockly.Python.ORDER_NONE) || 'False';
  var code = 'if ' + condition + ':\n';
  if (Blockly.Python.STATEMENT_SUFFIX) {
    // Inject any statement suffix here since the regular one at the end
    // will not get executed if the return is triggered.
    code += Blockly.Python.prefixLines(
        Blockly.Python.injectId(Blockly.Python.STATEMENT_SUFFIX, block),
        Blockly.Python.INDENT);
  }
  if (block.hasReturnValue_) {
    var value = Blockly.Python.valueToCode(block, 'VALUE',
        Blockly.Python.ORDER_NONE) || 'None';
    code += Blockly.Python.INDENT + 'return ' + value + '\n';
  } else {
    code += Blockly.Python.INDENT + 'return\n';
  }
  return code;
};
/**
 * @license
 * Copyright 2012 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Python for text blocks.
 * @author q.neutron@gmail.com (Quynh Neutron)
 */
'use strict';

goog.provide('Blockly.Python.texts');

goog.require('Blockly.Python');


Blockly.Python['text'] = function(block) {
  // Text value.
  var code = Blockly.Python.quote_(block.getFieldValue('TEXT'));
  return [code, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python['text_multiline'] = function(block) {
  // Text value.
  var code = Blockly.Python.multiline_quote_(block.getFieldValue('TEXT'));
  return [code, Blockly.Python.ORDER_ATOMIC];
};

/**
 * Enclose the provided value in 'str(...)' function.
 * Leave string literals alone.
 * @param {string} value Code evaluating to a value.
 * @return {string} Code evaluating to a string.
 * @private
 */
Blockly.Python.text.forceString_ = function(value) {
  if (Blockly.Python.text.forceString_.strRegExp.test(value)) {
    return value;
  }
  return 'str(' + value + ')';
};

/**
 * Regular expression to detect a single-quoted string literal.
 */
Blockly.Python.text.forceString_.strRegExp = /^\s*'([^']|\\')*'\s*$/;

Blockly.Python['text_join'] = function(block) {
  // Create a string made up of any number of elements of any type.
  //Should we allow joining by '-' or ',' or any other characters?
  switch (block.itemCount_) {
    case 0:
      return ['\'\'', Blockly.Python.ORDER_ATOMIC];
      break;
    case 1:
      var element = Blockly.Python.valueToCode(block, 'ADD0',
              Blockly.Python.ORDER_NONE) || '\'\'';
      var code = Blockly.Python.text.forceString_(element);
      return [code, Blockly.Python.ORDER_FUNCTION_CALL];
      break;
    case 2:
      var element0 = Blockly.Python.valueToCode(block, 'ADD0',
          Blockly.Python.ORDER_NONE) || '\'\'';
      var element1 = Blockly.Python.valueToCode(block, 'ADD1',
          Blockly.Python.ORDER_NONE) || '\'\'';
      var code = Blockly.Python.text.forceString_(element0) + ' + ' +
          Blockly.Python.text.forceString_(element1);
      return [code, Blockly.Python.ORDER_ADDITIVE];
      break;
    default:
      var elements = [];
      for (var i = 0; i < block.itemCount_; i++) {
        elements[i] = Blockly.Python.valueToCode(block, 'ADD' + i,
                Blockly.Python.ORDER_NONE) || '\'\'';
      }
      var tempVar = Blockly.Python.variableDB_.getDistinctName('x',
          Blockly.VARIABLE_CATEGORY_NAME);
      var code = '\'\'.join([str(' + tempVar + ') for ' + tempVar + ' in [' +
          elements.join(', ') + ']])';
      return [code, Blockly.Python.ORDER_FUNCTION_CALL];
  }
};

Blockly.Python['text_append'] = function(block) {
  // Append to a variable in place.
  var varName = Blockly.Python.variableDB_.getName(block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME);
  var value = Blockly.Python.valueToCode(block, 'TEXT',
      Blockly.Python.ORDER_NONE) || '\'\'';
  return varName + ' = str(' + varName + ') + ' +
      Blockly.Python.text.forceString_(value) + '\n';
};

Blockly.Python['text_length'] = function(block) {
  // Is the string null or array empty?
  var text = Blockly.Python.valueToCode(block, 'VALUE',
      Blockly.Python.ORDER_NONE) || '\'\'';
  return ['len(' + text + ')', Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['text_isEmpty'] = function(block) {
  // Is the string null or array empty?
  var text = Blockly.Python.valueToCode(block, 'VALUE',
      Blockly.Python.ORDER_NONE) || '\'\'';
  var code = 'not len(' + text + ')';
  return [code, Blockly.Python.ORDER_LOGICAL_NOT];
};

Blockly.Python['text_indexOf'] = function(block) {
  // Search the text for a substring.
  // Should we allow for non-case sensitive???
  var operator = block.getFieldValue('END') == 'FIRST' ? 'find' : 'rfind';
  var substring = Blockly.Python.valueToCode(block, 'FIND',
      Blockly.Python.ORDER_NONE) || '\'\'';
  var text = Blockly.Python.valueToCode(block, 'VALUE',
      Blockly.Python.ORDER_MEMBER) || '\'\'';
  var code = text + '.' + operator + '(' + substring + ')';
  if (block.workspace.options.oneBasedIndex) {
    return [code + ' + 1', Blockly.Python.ORDER_ADDITIVE];
  }
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['text_charAt'] = function(block) {
  // Get letter at index.
  // Note: Until January 2013 this block did not have the WHERE input.
  var where = block.getFieldValue('WHERE') || 'FROM_START';
  var text = Blockly.Python.valueToCode(block, 'VALUE',
      Blockly.Python.ORDER_MEMBER) || '\'\'';
  switch (where) {
    case 'FIRST':
      var code = text + '[0]';
      return [code, Blockly.Python.ORDER_MEMBER];
    case 'LAST':
      var code = text + '[-1]';
      return [code, Blockly.Python.ORDER_MEMBER];
    case 'FROM_START':
      var at = Blockly.Python.getAdjustedInt(block, 'AT');
      var code = text + '[' + at + ']';
      return [code, Blockly.Python.ORDER_MEMBER];
    case 'FROM_END':
      var at = Blockly.Python.getAdjustedInt(block, 'AT', 1, true);
      var code = text + '[' + at + ']';
      return [code, Blockly.Python.ORDER_MEMBER];
    case 'RANDOM':
      Blockly.Python.definitions_['import_random'] = 'import random';
      var functionName = Blockly.Python.provideFunction_(
          'text_random_letter',
          ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(text):',
           '  x = int(random.random() * len(text))',
           '  return text[x];']);
      code = functionName + '(' + text + ')';
      return [code, Blockly.Python.ORDER_FUNCTION_CALL];
  }
  throw Error('Unhandled option (text_charAt).');
};

Blockly.Python['text_getSubstring'] = function(block) {
  // Get substring.
  var where1 = block.getFieldValue('WHERE1');
  var where2 = block.getFieldValue('WHERE2');
  var text = Blockly.Python.valueToCode(block, 'STRING',
      Blockly.Python.ORDER_MEMBER) || '\'\'';
  switch (where1) {
    case 'FROM_START':
      var at1 = Blockly.Python.getAdjustedInt(block, 'AT1');
      if (at1 == '0') {
        at1 = '';
      }
      break;
    case 'FROM_END':
      var at1 = Blockly.Python.getAdjustedInt(block, 'AT1', 1, true);
      break;
    case 'FIRST':
      var at1 = '';
      break;
    default:
      throw Error('Unhandled option (text_getSubstring)');
  }
  switch (where2) {
    case 'FROM_START':
      var at2 = Blockly.Python.getAdjustedInt(block, 'AT2', 1);
      break;
    case 'FROM_END':
      var at2 = Blockly.Python.getAdjustedInt(block, 'AT2', 0, true);
      // Ensure that if the result calculated is 0 that sub-sequence will
      // include all elements as expected.
      if (!Blockly.isNumber(String(at2))) {
        Blockly.Python.definitions_['import_sys'] = 'import sys';
        at2 += ' or sys.maxsize';
      } else if (at2 == '0') {
        at2 = '';
      }
      break;
    case 'LAST':
      var at2 = '';
      break;
    default:
      throw Error('Unhandled option (text_getSubstring)');
  }
  var code = text + '[' + at1 + ' : ' + at2 + ']';
  return [code, Blockly.Python.ORDER_MEMBER];
};

Blockly.Python['text_changeCase'] = function(block) {
  // Change capitalization.
  var OPERATORS = {
    'UPPERCASE': '.upper()',
    'LOWERCASE': '.lower()',
    'TITLECASE': '.title()'
  };
  var operator = OPERATORS[block.getFieldValue('CASE')];
  var text = Blockly.Python.valueToCode(block, 'TEXT',
      Blockly.Python.ORDER_MEMBER) || '\'\'';
  var code = text + operator;
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['text_trim'] = function(block) {
  // Trim spaces.
  var OPERATORS = {
    'LEFT': '.lstrip()',
    'RIGHT': '.rstrip()',
    'BOTH': '.strip()'
  };
  var operator = OPERATORS[block.getFieldValue('MODE')];
  var text = Blockly.Python.valueToCode(block, 'TEXT',
      Blockly.Python.ORDER_MEMBER) || '\'\'';
  var code = text + operator;
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['text_print'] = function(block) {
  // Print statement.
  var msg = Blockly.Python.valueToCode(block, 'TEXT',
      Blockly.Python.ORDER_NONE) || '\'\'';
  return 'print(' + msg + ')\n';
};

Blockly.Python['text_prompt_ext'] = function(block) {
  // Prompt function.
  var functionName = Blockly.Python.provideFunction_(
      'text_prompt',
      ['def ' + Blockly.Python.FUNCTION_NAME_PLACEHOLDER_ + '(msg):',
       '  try:',
       '    return raw_input(msg)',
       '  except NameError:',
       '    return input(msg)']);
  if (block.getField('TEXT')) {
    // Internal message.
    var msg = Blockly.Python.quote_(block.getFieldValue('TEXT'));
  } else {
    // External message.
    var msg = Blockly.Python.valueToCode(block, 'TEXT',
        Blockly.Python.ORDER_NONE) || '\'\'';
  }
  var code = functionName + '(' + msg + ')';
  var toNumber = block.getFieldValue('TYPE') == 'NUMBER';
  if (toNumber) {
    code = 'float(' + code + ')';
  }
  return [code, Blockly.Python.ORDER_FUNCTION_CALL];
};

Blockly.Python['text_prompt'] = Blockly.Python['text_prompt_ext'];

Blockly.Python['text_count'] = function(block) {
  var text = Blockly.Python.valueToCode(block, 'TEXT',
      Blockly.Python.ORDER_MEMBER) || '\'\'';
  var sub = Blockly.Python.valueToCode(block, 'SUB',
      Blockly.Python.ORDER_NONE) || '\'\'';
  var code = text + '.count(' + sub + ')';
  return [code, Blockly.Python.ORDER_MEMBER];
};

Blockly.Python['text_replace'] = function(block) {
  var text = Blockly.Python.valueToCode(block, 'TEXT',
      Blockly.Python.ORDER_MEMBER) || '\'\'';
  var from = Blockly.Python.valueToCode(block, 'FROM',
      Blockly.Python.ORDER_NONE) || '\'\'';
  var to = Blockly.Python.valueToCode(block, 'TO',
      Blockly.Python.ORDER_NONE) || '\'\'';
  var code = text + '.replace(' + from + ', ' + to + ')';
  return [code, Blockly.Python.ORDER_MEMBER];
};

Blockly.Python['text_reverse'] = function(block) {
  var text = Blockly.Python.valueToCode(block, 'TEXT',
      Blockly.Python.ORDER_MEMBER) || '\'\'';
  var code = text + '[::-1]';
  return [code, Blockly.Python.ORDER_MEMBER];
};
/**
 * @license
 * Copyright 2012 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Python for variable blocks.
 * @author q.neutron@gmail.com (Quynh Neutron)
 */
'use strict';

goog.provide('Blockly.Python.variables');

goog.require('Blockly.Python');


Blockly.Python['variables_get'] = function(block) {
  // Variable getter.
  var code = Blockly.Python.variableDB_.getName(block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME);
  return [code, Blockly.Python.ORDER_ATOMIC];
};

Blockly.Python['variables_set'] = function(block) {
  // Variable setter.
  var argument0 = Blockly.Python.valueToCode(block, 'VALUE',
      Blockly.Python.ORDER_NONE) || '0';
  var varName = Blockly.Python.variableDB_.getName(block.getFieldValue('VAR'),
      Blockly.VARIABLE_CATEGORY_NAME);
  return varName + ' = ' + argument0 + '\n';
};
/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Generating Python for dynamic variable blocks.
 * @author fenichel@google.com (Rachel Fenichel)
 */
'use strict';

goog.provide('Blockly.Python.variablesDynamic');

goog.require('Blockly.Python');
goog.require('Blockly.Python.variables');


// Python is dynamically typed.
Blockly.Python['variables_get_dynamic'] = Blockly.Python['variables_get'];
Blockly.Python['variables_set_dynamic'] = Blockly.Python['variables_set'];
