const metadataModule = require('./metadata.js');
const prefixModule = require('./prefix.js');
const retrievePrefixes = prefixModule.retrievePrefixes;
const searchPrefix = prefixModule.searchPrefix;
const embed_parameter = require('./embed_parameter.js');

exports.constructSparql = (sparqlTemplate, parameterMap) =>
{
  var metadata = metadataModule.retrieveMetadata(sparqlTemplate);
  if(metadata.prefix) {
    if(/^(http|https):\/\//.test(metadata.prefix))
      prefixModule.loadPrefixFileByURL(metadata.prefix);
    else
      prefixModule.loadPrefixFile(metadata.prefix);
  }
  if(metadata.param) parameterMap = { ...metadata.param, ...parameterMap };
  if(metadata.input) {
    parameterMap['INPUT'] = '(' + metadata.input.join(' ') + ')';
  }
  sparqlTemplate = embed_parameter.embedParameter(sparqlTemplate, parameterMap);
  prefixes = retrievePrefixes(sparqlTemplate);
  sparqlTemplate = prefixes.map(pre => searchPrefix(pre)).join("\n") + "\n" + sparqlTemplate;
  return [sparqlTemplate, metadata];
}

