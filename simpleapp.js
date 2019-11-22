var fs = require('fs');

function readFiles(dirname, onFileContent, onError) {
  fs.readdir(dirname, function(err, filenames) {
    if (err) {
      onError(err);
      return;
    }
    var i = 0;
    var j = 0;
    filenames.forEach(function(filename) {
      fs.readFile(dirname + filename, 'utf-8', function(err, content) {
        if (err) {
            j++;
          onError(err);
          return;
        }
        console.log("Content found for " + (++i) + ". " + filename);
        onFileContent(filename, content);
      });
    })
    console.log("Errors in " + j + " files.");
    ;
  });
}

var data = {};
readFiles('C:\\A123\\git\\Deepak\\FHIR\\fhir_rdf_validator\\tests\\cache\\', function(filename, content) {
  data[filename] = content;
}, function(err) {
  throw err;
});