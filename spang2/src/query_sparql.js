request = require('request')
var version = require("../package.json").version;

const acceptHeaderMap = {
  "xml"      : "application/sparql-results+xml",
  "json"     : "application/sparql-results+json",
  "tsv"      : "application/sparql-results+json", // receive as json and format to tsv afterward
  "text/tsv" : "text/tab-separated-values",
  "n-triples": "text/plain",
  "nt"       : "text/plain",
  "n3"       : "text/rdf+n3",
  "html"     : "text/html",
  "bool"     : "text/boolean",
  "turtle"   : "application/x-turtle",
  "ttl"      : "application/x-turtle",
  "rdf/xml"  : "application/rdf+xml",
  "rdfxml"   : "application/rdf+xml",
  "rdfjson"  : "application/rdf+json",
  "rdfbin"   : "application/x-binary-rdf",
  "rdfbint"  : "application/x-binary-rdf-results-table",
  "js"       : "application/javascript",
};


module.exports = (endpoint, query, format, callback) => {
  const accept = acceptHeaderMap[format];
  var options = {
    uri: endpoint, 
    form: {query: query},
    qs: {query: query},
    followAllRedirects: true,
    headers:{ 
      "User-agent": `spang2/spang2_${version}`, 
      "Accept": accept
    }
  };
  request.post(options, callback);
};
