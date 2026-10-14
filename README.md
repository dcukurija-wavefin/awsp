# AWSP - AWS Profile Switcher

Easily switch between AWS Profiles

<img src="demo.gif" width="500">

## Prereqs
Setup your profiles using the aws cli

```sh
aws configure --profile PROFILE_NAME
```

You can also leave out the `--profile PROFILE_NAME` param to set your `default` credentials

Refer to this doc for more information
https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html

## Setup

```sh
npm install -g awsp
```

Add the following to your `.bashrc` or `.zshrc` config
```sh
alias awsp="source _awsp"
```

## Usage
```sh
awsp
```

If [fzf](https://github.com/junegunn/fzf) is installed, profiles are picked with fuzzy search. Otherwise the plain list prompt is used.

Profiles created by [aws-sso](https://github.com/synfinatic/aws-sso-cli) are listed with the name of their SSO instance in front, so you can filter by instance too. Other profiles show `-`.

To only list the profiles of one aws-sso instance:
```sh
awsp --sso <instance>
```

Pass a query to pre-filter the list. If it matches a single profile, that profile is selected immediately:
```sh
awsp <query>
```

Pressing Esc keeps the current profile.

## Show your AWS Profile in your shell prompt
For better visibility into what your shell is set to it's helpful to configure your prompt to show the value of the env variable `AWS_PROFILE`.

<img src="screenshot.png" width="300">

Here's a sample of my zsh prompt config using oh-my-zsh themes

```sh
function aws_prof {
  local profile="${AWS_PROFILE:=default}"

  echo "%{$fg_bold[blue]%}aws:(%{$fg[yellow]%}${profile}%{$fg_bold[blue]%})%{$reset_color%} "
}
```

```sh
PROMPT='OTHER_PROMPT_STUFF $(aws_prof)'
```