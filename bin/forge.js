#!/usr/bin/env node
import { createCli } from "../dist/cli/index.js";

const cli = createCli();
cli.parse(process.argv);
