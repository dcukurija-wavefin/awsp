#!/usr/bin/env node

const fs = require('fs');
const { spawnSync } = require('child_process');
const inquirer = require('inquirer');

console.log('AWS Profile Switcher');

const homeDir = process.env['HOME']
const profileHeaderRegex = /^\[profile (.*)\]\s*$/;
// Matches the SSO instance in profiles written by `aws-sso setup profiles`,
// e.g. credential_process = aws-sso -S "<instance>" process --arn ...
const ssoInstanceRegex = /^credential_process\s*=.*aws-sso.*?(?:-S|--sso)[ =]"?([^"\s]+)"?/;
const labelSeparator = ' | ';
const noSsoLabel = '-';
const defaultProfileChoice = 'default';
const configPath = `${homeDir}/.aws/config`;

// Usage: _awsp_prompt [--sso <instance>] [query...]
const parseArgs = (args) => {
  const ssoIndex = args.indexOf('--sso');

  if (ssoIndex === -1) {
    return { sso: null, query: args.join(' ') };
  }

  const rest = args.filter((_, i) => i !== ssoIndex && i !== ssoIndex + 1);

  return { sso: args[ssoIndex + 1], query: rest.join(' ') };
};

const { sso: ssoFilter, query } = parseArgs(process.argv.slice(2));

const hasFzf = () => spawnSync('fzf', ['--version']).status === 0;

// Returns [{ name, sso }] for every [profile ...] section in ~/.aws/config
const parseProfiles = (data) => {
  const profiles = [];
  let current = null;

  data.split('\n').forEach((line) => {
    const header = line.match(profileHeaderRegex);

    if (header) {
      current = { name: header[1], sso: noSsoLabel };
      profiles.push(current);
    } else if (line.startsWith('[')) {
      current = null;
    } else if (current) {
      const sso = line.match(ssoInstanceRegex);

      if (sso) {
        current.sso = sso[1];
      }
    }
  });

  return profiles;
};

const toLabels = (profiles) => {
  const width = Math.max(...profiles.map((profile) => profile.sso.length));

  return profiles.map((profile) => ({
    name: `${profile.sso.padEnd(width)}${labelSeparator}${profile.name}`,
    value: profile.name
  }));
};

const promptWithFzf = (choices) => {
  const result = spawnSync('fzf', [
    '--height', '40%',
    '--reverse',
    '--no-sort',
    '--prompt', 'AWS profile> ',
    '--query', query,
    '--select-1',
    '--exit-0'
  ], {
    input: choices.map((choice) => choice.name).join('\n'),
    stdio: ['pipe', 'pipe', 'inherit'],
    encoding: 'utf8'
  });

  // Esc / Ctrl-C / no match: keep the current profile
  if (result.status !== 0) {
    return { profile: process.env.AWS_PROFILE || defaultProfileChoice };
  }

  const line = result.stdout.trim();

  return { profile: line.slice(line.indexOf(labelSeparator) + labelSeparator.length) };
};

const promptProfileChoice = (data) => {
  const profiles = parseProfiles(data)
    .filter((profile) => !ssoFilter || profile.sso === ssoFilter)
    .sort((a, b) => a.sso.localeCompare(b.sso) || a.name.localeCompare(b.name));

  if (!profiles.length && ssoFilter) {
    console.log(`No profiles found for SSO instance "${ssoFilter}".`);
    console.log(`Run: aws-sso -S ${ssoFilter} setup profiles`);

    return { profile: process.env.AWS_PROFILE || defaultProfileChoice };
  }

  if (!profiles.length) {
    console.log('No profiles found.');
    console.log('Refer to this guide for help on setting up a new AWS profile:');
    console.log('https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html');

    return { profile: process.env.AWS_PROFILE || defaultProfileChoice };
  }

  if (!ssoFilter) {
    profiles.push({ name: defaultProfileChoice, sso: noSsoLabel });
  }

  const choices = toLabels(profiles);

  if (hasFzf()) {
    return promptWithFzf(choices);
  }

  const profileChoice = [
    {
      type: 'list',
      name: 'profile',
      message: 'Choose a profile',
      choices,
      default: process.env.AWS_PROFILE || defaultProfileChoice
    }
  ];

  return inquirer.prompt(profileChoice);
}

const readAwsProfiles = () => {
  return new Promise((resolve, reject) => {
    fs.readFile(configPath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

const writeToConfig = (answers) => {
  const profileChoice =
        answers.profile === defaultProfileChoice ? '' : answers.profile;

  return new Promise((resolve, reject) => {
    fs.writeFile(`${homeDir}/.awsp`, profileChoice, { flag: 'w' }, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

readAwsProfiles()
  .then(promptProfileChoice)
  .then(writeToConfig)
  .catch(error => {
    console.log('Error:', error);
    process.exit(1);
  });
