let output;
let commentsList;
let currentIndent;
let indentUnit = '  ';

exports.format = (syntaxTree, indentDepth = 2) => {
  indentUnit = ' '.repeat(indentDepth);

  output = [];
  commentsList = syntaxTree.comments;
  currentIndent = '';

  if (syntaxTree.headers.length > 0) {
    addLine(syntaxTree.headers.join(''));
  }
  syntaxTree.prologue.prefixes.forEach((prefix) => {
    addLine(`PREFIX ${prefix.prefix || ''}: <${prefix.local}>`);
  });
  if (syntaxTree.prologue.prefixes.length > 0) {
    addLine('');
  }

  syntaxTree.functions.forEach(addFunction);

  if (syntaxTree.body?.kind === 'select') {
    addSelect(syntaxTree.body);
  } else if (syntaxTree.body?.kind === 'construct') {
    addConstruct(syntaxTree.body);
  } else if (syntaxTree.units) {
    syntaxTree.units.forEach((unit) => {
      addUnit(unit);
    });
  }
  if (syntaxTree.inlineData) {
    addInlineData(syntaxTree.inlineData);
  }

  addComments();

  return output.join('\n');
};

const debugPrint = (object) => {
  console.log(JSON.stringify(object, undefined, 2));
};

const increaseIndent = (depth = 1) => {
  currentIndent += indentUnit.repeat(depth);
};

const decreaseIndent = (depth = 1) => {
  currentIndent = currentIndent.substr(0, currentIndent.length - indentUnit.length * depth);
};

const addLine = (lineText, commentPtr = 0) => {
  // 0 means min ptr, so no comments will be added.
  addComments(commentPtr);
  output.push(currentIndent + lineText);
};

const addComments = (commentPtr = -1) => {
  // -1 means 'max' ptr, so all comments will be added.
  let commentAdded = false;
  while (commentsList.length > 0 && (commentsList[0].line < commentPtr || commentPtr == -1)) {
    const commentText = commentsList.shift().text;
    if (commentAdded || commentPtr == -1 || output[output.length - 1] === '') {
      // newline is necessary before comment
      output.push(commentText);
    } else {
      // newline is not necessary
      output[output.length - 1] += commentText;
    }
    commentAdded = true;
  }
};

const addUnit = (unit) => {
  if (unit.kind === 'insertdata') {
    addLine('INSERT DATA');
    addQuads(unit.quads);
  } else if (unit.kind === 'deletedata') {
    addLine('DELETE DATA');
    addQuads(unit.quads);
  } else if (unit.kind === 'modify') {
    addLine('DELETE WHERE {');
    addGroupGraphPatternSub(unit.pattern);
    addLine('}');
  }
};

const addQuads = (quads) => {
  addLine('{');
  increaseIndent();
  quads.forEach((quad) => {
    addTriple(quad);
  });
  decreaseIndent();
  addLine('}');
};

const addSelect = (select) => {
  const proj = select.projection;
  const lastLine = proj[0].value ? proj[0].value.location.start.line : proj[0].location.start.line;

  let args = '';
  if (select.modifier) {
    args += `${select.modifier.toString()} `;
  }
  args += proj.map(getProjection).join(' ');
  addLine(`SELECT ${args}`, lastLine);

  select.dataset.implicit.forEach((graph) => {
    addFrom(graph);
  });

  addLine('WHERE {', lastLine + 1);
  addGroupGraphPatternSub(select.pattern);
  addLine('}', select.pattern.location.end.line);

  if (select.order) {
    addLine('ORDER BY ' + getOrderConditions(select.order));
  }
  if (select.limit) {
    addLine(`LIMIT ${select.limit}`);
  }
};

const addConstruct = (body) => {
  addLine('CONSTRUCT {');
  increaseIndent();
  body.template.triplesContext.forEach((triple) => {
    addTriple(triple);
  });
  decreaseIndent();
  addLine('}');

  body.dataset.implicit.forEach((graph) => {
    addFrom(graph);
  });

  addLine('WHERE {');
  addGroupGraphPatternSub(body.pattern);
  addLine('}');
}

const addFrom = (graph) => {
  const uri = getUri(graph);
  if (uri != null) {
    addLine('FROM ' + uri);
  }
}

const addGroupGraphPatternSub = (pattern) => {
  increaseIndent();
  pattern.patterns.forEach((p) => {
    switch (p.token) {
      case 'graphunionpattern':
        addLine('{');
        addGroupGraphPatternSub(p.value[0]);
        addLine('}');
        for (let i = 1; i < p.value.length; i++) {
          addLine('UNION');
          addLine('{');
          addGroupGraphPatternSub(p.value[i]);
          addLine('}');
        }
        break;
      case 'optionalgraphpattern':
        addLine('OPTIONAL {');
        addGroupGraphPatternSub(p.value);
        addLine('}');
        break;
      case 'basicgraphpattern':
        p.triplesContext.forEach(addTriple);
        break;
      case 'inlineData':
        addInlineData(p);
        break;
      case 'inlineDataFull':
        addInlineData(p);
        break;
      case 'expression':
        if (p.expressionType === 'functioncall') {
          const args = p.args.map(getExpression).join(', ');
          addLine(getUri(p.iriref) + `(${args})`);
        } else {
          debugPrint(p);
        }
        break;
      default:
        debugPrint(p);
    }
  });
  pattern.filters.forEach(addFilter);
  decreaseIndent();
};

const getOrderConditions = (conditions) => {
  let orderConditions = [];
  conditions.forEach((condition) => {
    const oc = getVar(condition.expression.value);
    if (condition.direction == 'DESC') {
      orderConditions.push(`DESC(${oc})`);
    } else {
      orderConditions.push(oc);
    }
  });

  return orderConditions.join(' ');
};

const getProjection = (projection) => {
  switch (projection.kind) {
    case '*':
      return '*';
    case 'var':
      return '?' + projection.value.value;
    case 'aliased':
      return `(${getExpression(projection.expression)} AS ?${projection.alias.value})`;
    default:
      throw new Error('unknown projection.kind: ' + projection.kind);
  }
};

const addFilter = (filter) => {
  if (filter.value.expressionType == 'relationalexpression') {
    const op = filter.value.operator;
    const op1 = getExpression(filter.value.op1);
    const op2 = getExpression(filter.value.op2);
    addLine(`FILTER (${op1} ${op} ${op2})`);
  }
};

const addFunction = (func) => {
  const name = getUri(func.header.iriref);
  const args = func.header.args.map(getExpression).join(', ');
  addLine(`${name}(${args}) {`);
  addGroupGraphPatternSub(func.body);
  addLine('}');
  addLine('');
};

const addTriple = (triple) => {
  const s = getTripleElem(triple.subject);
  const p = getTripleElem(triple.predicate);
  const o = getTripleElem(triple.object);
  addLine(`${s} ${p} ${o} .`, triple.object.location.end.line);
};

const getExpression = (expr) => {
  switch (expr.expressionType) {
    case 'atomic':
      return getTripleElem(expr.value);
    case 'irireforfunction':
      return getUri(expr.iriref); // how about function?
    case 'builtincall':
      return expr.builtincall + '(' + expr.args.map(getExpression).join(', ') + ')';
    case 'aggregate':
      if (expr.aggregateType === 'sample') {
        return `SAMPLE(?${expr.expression.value.value})`;
      }
  }
};

const addInlineData = (inline) => {
  switch (inline.token) {
    case 'inlineData':
      const v = getTripleElem(inline.var);
      const vals = inline.values.map(getTripleElem).join(' ');
      addLine(`VALUES ${v} { ${vals} }`);
      break;
    case 'inlineDataFull':
      const varlist = inline.variables.map(getVar).join(' ');
      if (inline.variables.length === 1) {
        const vals = inline.values.map((tuple) => {
          return '(' + tuple.map(getTripleElem).join(' ') + ')';
        }).join(' ');
        addLine(`VALUES (${varlist}) { ${vals} }`);
      } else {
        addLine(`VALUES (${varlist}) {`);
        increaseIndent();
        inline.values.map((tuple) => {
          addLine('(' + tuple.map(getTripleElem).join(' ') + ')');
        });
        decreaseIndent();
        addLine('}');
      }
      break;
  }
};

const getTripleElem = (elem) => {
  switch (elem.token) {
    case 'uri':
      return getUri(elem);
    case 'var':
      return getVar(elem);
    case 'literal':
      var txt = `"${elem.value}"`;
      if (elem.lang) {
        txt += `@${elem.lang}`;
      }
      return txt;
    case 'path':
      return elem.value.map((v) => getUri(v.value)).join('/');
    case 'blank':
      return '[]';
    default:
      debugPrint(elem);
  }
};

const getUri = (uri) => {
  if (uri.prefix && uri.suffix) {
    return `${uri.prefix}:${uri.suffix}`;
  } else if (uri.prefix) {
    return `${uri.prefix}:`;
  } else if (uri.suffix) {
    return `:${uri.suffix}`;
  } else if (uri.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
    return 'a';
  } else if (uri.value != null) {
    return `<${uri.value}>`;
  } else {
    return null;
  }
};

const getVar = (variable) => {
  if (variable.prefix === '?') {
    return '?' + variable.value;
  } else if (variable.prefix === '$') {
    return '$' + variable.value;
  } else {
    return '{{' + variable.value + '}}';
  }
};
