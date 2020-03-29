const metadataModule = require('./metadata.js');
const prefixModule = require('./prefix.js');
const retrievePrefixes = prefixModule.retrievePrefixes;
const searchPrefix = prefixModule.searchPrefix;
const embed_parameter = require('./embed_parameter.js');
const fs = require('fs');

exports.constructSparql = (sparqlTemplate, parameterMap, input='') => {
  // get metadata
  var metadata = metadataModule.retrieveMetadata(sparqlTemplate);
  if (metadata.prefix) {
    if (/^(http|https):\/\//.test(metadata.prefix))
      prefixModule.loadPrefixFileByURL(metadata.prefix);
    else
      prefixModule.loadPrefixFile(metadata.prefix);
  }
  if (metadata.param) {
    parameterMap = { ...metadata.param, ...parameterMap };
  }

  // get input, or use metadata by default
  if (input) {
    parameterMap['INPUT'] = input.split("\n").
      filter(line => line.length > 0).
      map(line => '(' + line + ')').
      join(' ');
  } else if (metadata.input) {
    parameterMap['INPUT'] = '(' + metadata.input.join(' ') + ')';
  }

  // embed parameter
  sparqlTemplate = embed_parameter.embedParameter(sparqlTemplate, parameterMap);

  // add prefix declarations
  prefixes = retrievePrefixes(sparqlTemplate);
  sparqlTemplate = prefixes.map(pre => searchPrefix(pre)).join("\n") + "\n" + sparqlTemplate;

  return [sparqlTemplate, metadata];
}

