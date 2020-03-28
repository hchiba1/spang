var Output;
var CommentsList;
var currentIndent;
indentUnit = '  ';

exports.format = (syntaxTree, indentDepth = 2) => {
  indentUnit = ' '.repeat(indentDepth);

  Output = [];
  CommentsList = syntaxTree.commentsList;
  currentIndent = '';

  if (syntaxTree.header) {
    addLine(syntaxTree.header);
  }
  addPrologue(syntaxTree.prologue);
  syntaxTree.functions.forEach(addFunction);
  addQuery(syntaxTree.body);
  if (syntaxTree.inlineData) {
    addInlineData(syntaxTree.inlineData);
  }
  if (CommentsList.length > 0) {
    addLine('', -1);
  }

  return Output.join('\n');
};

/// Local functions //////////////////////////////////////////

debugPrint = (object) => {
  console.log(JSON.stringify(object, undefined, 2));
};

increaseIndent = (depth = 1) => {
  currentIndent += indentUnit.repeat(depth);
};

decreaseIndent = (depth = 1) => {
  currentIndent = currentIndent.substr(0, currentIndent.length - indentUnit.length * depth);
};

addLine = (lineText, commentPtr = 0) => {

  while (CommentsList.length > 0 && (CommentsList[0].line < commentPtr || commentPtr == -1)) {
      var comment = CommentsList[0].text;
      if (Output.length == 0) {
        Output.unshift(comment);
      } else if (commentPtr == -1) {
        Output.push(comment);
      } else if (Output[Output.length-1] === '') {
        Output.push(comment);
      } else {
        Output[Output.length-1] += ' ' + comment;
      }
      CommentsList.shift();
  }

  if (commentPtr >= 0) {
    Output.push(currentIndent + lineText);
  }

  // while (CommentsList.length > 0 && CommentsList[0].line <= commentPtr) {
  //   if (lineText == '') {
  //     Output.push(currentIndent + CommentsList[0].text);
  //     CommentsList.shift();
  //   } else if (CommentsList[0].line == commentPtr) {
  //     Output[Output.length-1] += ' ' + CommentsList[0].text;
  //     CommentsList.shift();
  //   } else {
  //     Output.push(currentIndent + CommentsList[0].text);
  //     CommentsList.shift();
  //   }
  // }

}

addPrologue = (prologue) => {
  // TODO: handle base
  prologue.prefixes.forEach((prefix) => {
    addLine(`PREFIX ${prefix.prefix||""}: <${prefix.local}>`, prefix.location.end.line);
  });
  if(prologue.prefixes.length > 0) {
    addLine("", prologue.prefixes[prologue.prefixes.length - 1].location.end.line + 1);
  }
};

addQuery = (query) => {
  switch (query.kind) {
    case 'select':
    addSelect(query);
  }
};

addSelect = (select) => {
  var selectClause = 'SELECT ';
  if (select.modifier) {
    selectClause += `${select.modifier.toString()} `;
  }
  var projection = select.projection.map(getProjection).join(' ');
  selectClause += projection;
  var lastLine = !select.projection[0].value ?
      select.projection[0].location.start.line :
      select.projection[0].value.location.start.line;
  addLine(selectClause, lastLine);

  addLine('WHERE {', lastLine + 1);
  addGroupGraphPattern(select.pattern);
  addLine('}', select.pattern.location.end.line);

  if (select.order) {
    addLine('ORDER BY ' + getOrderConditions(select.order));
  }
  if(select.limit) {
    // addLine(`LIMIT ${select.limit}`, select.location.end.line);
    addLine(`LIMIT ${select.limit}`);
  }
};

addGroupGraphPattern = (pattern) => {
  increaseIndent();
  pattern.patterns.forEach(addPattern);
  pattern.filters.forEach(addFilter);
  decreaseIndent();
};

addPattern = (pattern) => {
  switch (pattern.token) {
    case 'graphunionpattern':
      addLine('{');
      addGroupGraphPattern(pattern.value[0]);
      addLine('}');
      addLine('UNION');
      addLine('{');
      addGroupGraphPattern(pattern.value[1]);
      addLine('}');
      break;
    case 'optionalgraphpattern':
      addLine('OPTIONAL {');
      addGroupGraphPattern(pattern.value);
      addLine('}');
      break;
    case 'basicgraphpattern':
      pattern.triplesContext.forEach(addTriple);
      break;
    case 'inlineData':
      addInlineData(pattern);
      break;
    case 'expression':
      if (pattern.expressionType === 'functioncall') {
        var name = getUri(pattern.iriref);
        var args = pattern.args.map(getExpression).join(", ");
        addLine(`${name}(${args})`);
      } else {
        debugPrint(pattern);
      }
      break;
    default:
      debugPrint(pattern);
  }
};

getOrderConditions = (conditions) => {
  var orderConditions = [];

  conditions.forEach(condition => {
    var oc = getVar(condition.expression.value);
    if (condition.direction == 'DESC') {
      orderConditions.push(`DESC(${oc})`);
    } else {
      orderConditions.push(oc);
    }
  });

  return orderConditions.join(" ");
};

getProjection = (projection) => {
  switch(projection.kind) {
    case '*':
      return '*';
    case 'var':
      return '?' + projection.value.value;
    case 'aliased':
      // TODO:
    default:
      throw new Error('unknown projection.kind: ' + projection.kind);
  }
};

addFilter = (filter) => {
  if (filter.value.expressionType == "relationalexpression") {
    var op = filter.value.operator;
    var op1 = getExpression(filter.value.op1);
    var op2 = getExpression(filter.value.op2);
    addLine(`FILTER (${op1} ${op} ${op2})`);
  }
}

addFunction = (func) => {
  var name = getUri(func.header.iriref);
  var args = func.header.args.map(getExpression).join(", ");
  addLine(`${name}(${args}) {`);
  addGroupGraphPattern(func.body);
  addLine('}');
  addLine('');
};

addTriple = (triple) => {
  var s = getTripleElem(triple.subject);
  var p = getTripleElem(triple.predicate);
  var o = getTripleElem(triple.object);
  addLine(`${s} ${p} ${o} .`, triple.object.location.end.line);
};

getExpression = (expr) => {
  switch (expr.expressionType) {
    case 'atomic':
      return(getTripleElem(expr.value));
    case 'irireforfunction':
      return(getUri(expr.iriref)); // how about function?
    case 'builtincall':
      return(expr.builtincall + '(' + expr.args.map(getExpression).join(', ') + ')');
  }
}

addInlineData = (inline) => {
  if (inline.token === 'inlineData') {
    var vals = inline.values.map(getTripleElem).join(' ');
    addLine(`VALUES ${getTripleElem(inline.var)} { ${vals} }`);
  } else {
    var vars = inline.variables.map(getVar).join(' ');
    var vals = inline.values.map(getTuple).join(' ')
    addLine(`VALUES (${vars}) { ${vals} }`)
  }
};

getTuple = (tuple) => {
  return '(' + tuple.map(getTripleElem).join(' ') + ')';
};

getTripleElem = (elem) => {
  switch(elem.token) {
    case 'uri':
      return(getUri(elem));
    case 'var':
      return(getVar(elem));
    case 'literal':
      var txt = `"${elem.value}"`;
      if (elem.lang) {
        txt += `@${elem.lang}`
      }
      return txt;
    case 'path':
      return elem.value.map(v => getUri(v.value)).join('/');
    case 'blank':
      return '[]';
    default:
      debugPrint(elem);
  }
};

getUri = (uri) => {
  if (uri.prefix && uri.suffix) {
    return `${uri.prefix}:${uri.suffix}`;
  } else if (uri.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
    return 'a';
  } else {
    return `<${uri.value}>`;
  }
}

getVar = (variable) => {
  if (variable.prefix === '?') {
    return '?' + variable.value;
  } else if (variable.prefix === '$') {
    return '$' + variable.value;
  } else {
    return '{{' + variable.value + '}}';
  }
}
