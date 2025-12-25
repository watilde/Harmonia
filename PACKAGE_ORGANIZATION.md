# Package.json Organization

## Status: ✅ Already Organized

All package.json files are properly organized:

### Root `/package.json`
**Purpose**: Workspace management and core development tools

**Scripts**:
- `build`: Build all workspace packages
- `clean`: Clean all workspace packages
- `test`: Run all workspace tests
- `test:validation`: Root-level validation tests
- `test:e2e:*`: End-to-end tests (in `/tests` directory)
- `lint`: Lint all files
- `format`: Format all files
- `typecheck`: Type check all workspaces
- `validate`: Run all quality checks

### Module-Specific Scripts

#### Module 1: `/research/modules/1-federated-partial-identification/package.json`
- `paper:plots`: Generate figures
- `paper:pdf`: Generate PDF
- `experiment:aggregation`: Run aggregation experiments

#### Module 2: `/research/modules/2-federated-evalues/package.json`
- `paper:plots`: Generate figures
- `paper:pdf`: Generate PDF
- `experiment:fri`: Run FRI validation

#### Module 3: `/research/modules/3-design-failure-aware-causal/package.json`
- `paper:plots`: Generate figures
- `paper:pdf`: Generate PDF
- `experiment:violations`: Run violation scenarios

#### Module 4: `/research/modules/4-identification-sensitivity-adaptation/package.json`
- `paper:pdf`: Generate PDF
- `experiment:paper1/2/3`: Run individual paper experiments
- `experiment:all`: Run all experiments

#### Module 5: `/research/modules/5-billion-scale-polypharmacy/package.json`
- `test`: Run optimized tests
- `test:unit`: Unit tests
- `test:quick`: Quick test (1k patients)
- `test:1m`: 1M patient test
- `test:10m`: 10M patient test
- `test:100m`: 100M patient test
- `test:1b`: 1B patient test
- `test:tier1/2/3`: Test specific tiers
- `test:profile:*`: Test different profiles (US, Japan, Nordic, India)
- `run:100m/1b`: Run optimized large-scale tests

## Running Module Scripts

To run a module-specific script:

```bash
# From root
cd research/modules/MODULE_NAME
npm run SCRIPT_NAME

# Example: Run module 5's 1M test
cd research/modules/5-billion-scale-polypharmacy
npm run test:1m

# Example: Generate module 1's PDF
cd research/modules/1-federated-partial-identification
npm run paper:pdf
```

## Design Principles

1. **Separation of concerns**: Root handles workspace, modules handle their own tests
2. **Self-contained modules**: Each module can be run independently
3. **Clear naming**: Scripts clearly indicate what they do
4. **Consistent patterns**: Similar scripts across modules (paper:pdf, experiment:*)
