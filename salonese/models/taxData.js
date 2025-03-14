const taxData = {
    "AB": { "GST": 0.05 },
    "BC": { "GST": 0.05, "PST": 0.07 },
    "MB": { "GST": 0.05, "PST": 0.07 },
    "NB": { "HST": 0.15 },
    "NL": { "HST": 0.15 },
    "NS": { "HST": 0.15 },
    "NT": { "GST": 0.5 },
    "NU": { "GST": 0.5 },
    "ON": { "HST": 0.13 },
    "PE": { "HST": 0.15 },
    "QC": { "GST": 0.05, "PST": 0.0998 }
  };
  
  module.exports = taxData; // Export the object so it can be used in other files
  