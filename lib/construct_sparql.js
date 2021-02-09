const prefixModule = require('./prefix.js');
const insertUndefinedPrefixes = prefixModule.insertUndefinedPrefixes;
const searchPrefix = prefixModule.searchPrefix;
const embedParameter = require('./embed_parameter.js');
const expandFunction = require('./expand_function.js');
const fs = require('fs');

exports.constructSparql = (sparqlTemplate, metadata, parameterMap, positionalArguments, input='') => {
  if (metadata.prefix) {
    prefixModule.loadPrefixFile(metadata.prefix);
  }
  if (metadata.param) {
    parameterMap = { ...Object.fromEntries(metadata.param.entries()), ...parameterMap };
    let i = 0;
    for(let param of metadata.param.keys()) {
      if(i >= positionalArguments.length) break;
      parameterMap[param] = positionalArguments[i++];
    }
  }

  // get input, or use metadata by default
  if (input) {
    parameterMap['INPUT'] = input.split("\n").
      filter(line => line.length > 0).
      map(line => '(' + line + ')').
      join(' ');
  } else if (metadata.input) {
    parameterMap['INPUT'] = metadata.input.join(' ');
  }

  // embed parameter
  sparqlTemplate = embedParameter.embedParameter(sparqlTemplate, parameterMap);

  sparqlTemplate = expandFunction(sparqlTemplate);

  // add prefix declarations
  sparqlTemplate = insertUndefinedPrefixes(sparqlTemplate);

  // remove trailing newlines
  sparqlTemplate = sparqlTemplate.replace(/\n{2,}$/g, '\n');

  return sparqlTemplate;
}

