#!/bin/bash
apt update -y && apt install openssh-client -y
# SSH setup
echo "$GH_BOT_SSH_KEY" > ssh.key
chmod 600 ssh.key
eval "$(ssh-agent -s)"
ssh-add ssh.key
mkdir ~/.ssh
ssh-keyscan github.com >> ~/.ssh/known_hosts

# GPG setup
echo "$GH_BOT_GPG_KEY" > private.key
gpg --import private.key
echo "$GH_BOT_GPG_TRUST" > trustdb
gpg --import-ownertrust trustdb

# git setup
git config user.email $GH_EMAIL
git config user.name $GH_USERNAME
git config commit.gpgSign true
git checkout -b release

# install GH cli
type -p curl >/dev/null || (apt update -y && apt install curl -y)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
&& chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
&& apt update -y \
&& apt install gh -y
gh config set prompt disabled

# install and run commitizen: https://commitizen-tools.github.io/commitizen/
export PATH="/root/.local/bin:$PATH"
pip install --user -U Commitizen
release_body=`cz bump --dry-run --changelog`
cz bump --yes
bump_status=$?

# if we have a bump, commit, update/create PR
if [[ $bump_status -eq 0 ]]
then
  commit_msg=`git log -1 --pretty=%B | sed 's/chore: r/R/g'`
  git push origin release --force --tags
  pr_exists=`gh pr view release --json 'state' --jq '.state == "OPEN"'`
  if [[ $pr_exists == 'true' ]]
  then
    gh pr edit \
    --title "$commit_msg" \
    --body "## :robot: This is an automated release PR
$release_body
## security considerations
Noted in individual PRs
"
  else
    gh pr create \
    --title "$commit_msg" \
    --body "## :robot: This is an automated release PR
$release_body
## security considerations
Noted in individual PRs
" \
    --base main \
    --head release
  fi
else
  echo "no update to the release"
fi
