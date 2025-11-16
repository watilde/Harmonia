# OMOP Data Directory

Downloaded Synthea OMOP CDM data from AWS S3.

## 📁 Structure

```
omop-data/
├── synthea1k/     # 1,000 patients (~30MB)
├── synthea100k/   # 100,000 patients (~300MB)
└── synthea2.3m/   # 2,300,000 patients (~1.5GB)
```

## 📥 Download

```bash
cd research

# Download datasets
npm run data:download:1k
npm run data:download:100k
npm run data:download:2.8m
```

## 📊 OMOP Tables

Each dataset contains standard OMOP CDM v5.3 tables:

- `person.csv` - Patient demographics
- `condition_occurrence.csv` - Diagnoses
- `drug_exposure.csv` - Medications
- `measurement.csv` - Lab results
- `procedure_occurrence.csv` - Procedures
- `observation.csv` - Observations
- `visit_occurrence.csv` - Visits
- `observation_period.csv` - Observation periods
- `condition_era.csv` - Condition eras
- `drug_era.csv` - Drug eras

## 🔗 Next Steps

After download, split data for federated experiments:

```bash
npm run data:split:1k
npm run data:split:100k
npm run data:split:2.8m
```

Results saved to `splits/` directory.
