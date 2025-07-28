---
title: Prepare Your Site
date: 2020-06-08T00:00:00Z
draft: false
hero: hero.svg
lang: en
---

In this post, we are going to create a hugo site from scratch. Then, we will configure it with Toha theme, make it multilingual, add some example posts. At the end of this post, you should be able to run a fully functional hugo site with Toha theme locally.

If you want a head start, you can just fork [hugo-toha/hugo-toha.github.io](https://github.com/hugo-toha/hugo-toha.github.io) repo, rename it and update with your own data. This repo has already been configured to deploy in Github Pages and Netlify.

## CREATE REPOSITORY

At first, create a repository in Github. If you want to deploy this site in Github Pages, your repo named should be `<your user name>.github.io`. Clone the repository into your local machine and navigate into it.

## CREATE SITE

Now, make sure that you have Hugo installed. This theme should work with hugo version `v0.118.0` and later. Now, run the following command in the root of your repository to initiate a hugo website.

```bash
hugo new site ./ --format=yaml --force
```

This command will create a basic hugo site structure. Here, `--format=yaml` flag tells hugo to create configuration file in YAML format and `--force` flag forces hugo to create a site even if the target directory is not empty. It will create `hugo.yaml` file that will hold the all the necessary configurations for your site.

## ADD THEME

We are going to use hugo module to add Toha theme into our site. At first, initialize hugo modules using the following command:

```bash
hugo mod init github.com/<your user name>/<your repo name>
```

This command will create a `go.mod` file in the root of your repository.

Then, add the following module section in your `hugo.yaml` file:

```yaml
module:
  imports:
  - path: github.com/hugo-toha/toha/v4
  mounts:
  - source: ./node_modules/flag-icon-css/flags
    target: static/flags
  - source: ./node_modules/@fontsource/mulish/files
    target: static/files
  - source: ./node_modules/katex/dist/fonts
    target: static/fonts
```

Finally, run the following commands to download the theme and its dependencies:

```bash
# download the theme
hugo mod get -u
# download the theme's dependencies
hugo mod tidy
# generate node dependencies
hugo mod npm pack
# install install dependencies
npm install
```

## RUN SITE LOCALLY

Now, you can already run your site locally. Let’s run the site in watch mode using the following command:

```bash
hugo server -w
```

If you navigate to `http://localhost:1313`, you should see a basic site with Toha theme. In the next section, we are going to configure the site to look like the `hugo-toha.github.io`. As we have run the server in watch mode, any changes we make to the site will be instantly visible in the browser.

## CONFIGURE SITE

Now, we are ready to configure our site. In this section, we are going to add author information, different sections, and sample posts etc.

### UPDATE HUGO.YAML

When you have created the site using `hugo new site` command, it has created a `hugo.yaml` file in the root of your repository. Replace the default content of the `hugo.yaml` file with the following:

```yaml
baseURL: https://hugo-toha.github.io

languageCode: en-us
title: "John's Blog"

# Use Hugo modules to add theme

module:
  imports:
  - path: github.com/hugo-toha/toha/v4
  mounts:
  - source: static/files
    target: static/files
  - source: ./node_modules/flag-icon-css/flags
    target: static/flags
  - source: ./node_modules/@fontsource/mulish/files
    target: static/files
  - source: ./node_modules/katex/dist/fonts
    target: static/fonts

# Manage languages
# For any more details, you can check the official documentation: https://gohugo.io/content-management/multilingual/
languages:
  en:
    languageName: English
    weight: 1
  fr:
    languageName: Français
    weight: 2

# Force a locale to be use, really useful to develop the application ! Should be commented in production, the "weight" should rocks.
# DefaultContentLanguage: bn

# Allow raw html in markdown file
markup:
  goldmark:
    renderer:
      unsafe: true
  tableOfContents:
    startLevel: 2
    endLevel: 6
    ordered: false

# At least HTML and JSON are required for the main HTML content and
# client-side JavaScript search
outputs:
  home:
    - HTML
    - RSS
    - JSON

# Enable global emoji support
enableEmoji: true

# Site parameters
params:
  # GitHub repo URL of your site
  gitRepo: https://github.com/hugo-toha/hugo-toha.github.io

  features:
    # Enable portfolio section
    portfolio:
      enable: true

    # Enable blog posts
    blog:
      enable: true

    # Enable Table of contents in reading page
    toc:
      enable: true

  # Configure footer
  footer:
    enable: true
```

### ADD DATA

Most of the contents of this theme is driven by some YAML files in `data` directory. In this section, we are going to add some sample data. Since, we’re building a multilingual site, we are going to keep the data for each language separate into their own locale folder.

At first, create `en` folder inside your `data` directory. We are going to add data for English language here.

#### SITE INFORMATION

Now, create a `site.yaml` file inside `/data/en/` directory of your repository. Add the following content there:

```yaml
# Copyright Notice
copyright: © 2020 Copyright.

# Meta description for your site.  This will help the search engines to find your site.
description: Portfolio and personal blog of John Doe.
```

To see all the available options for site information, check [this sample file](https://github.com/hugo-toha/hugo-toha.github.io/blob/main/data/en/site.yaml).

#### AUTHOR INFORMATION

Now, create a `author.yaml` file in `/data/en/` directory and add your information there as below:

```yaml
# some information about you
name: "John Doe"
nickname: "John"
# greeting message before your name. it will default to "Hi! I am" if not provided
greeting: "Hi, I am"
image: "images/author/john.png"
# give your some contact information. they will be used in the footer
contactInfo:
  email: "johndoe@example.com"
  phone: "+0123456789"
  github: johndoe
  linkedin: johndoe

# some summary about what you do
summary:
  - I am a Developer
  - I am a Devops
  - I love servers
  - I work on open-source projects
  - I love to work with some fun projects
```

### ADD SECTIONS

Now, we are going to add different sections into our home page. At first, create a `sections` folder inside your `/data/en` directory. Here, we are going to add few sections with minimum configurations. In order to see detailed configuration options for the sections, please visit [here](https://toha-guides.netlify.app/posts/configuration/).

#### ABOUT SECTION

Create `about.yaml` file inside your `/data/en/sections/` directory. Then add the following contents there:

```yaml
# section information
section:
  name: About
  id: about
  enable: true
  weight: 1
  showOnNavbar: true
  template: sections/about.html

# your designation
designation: Software Engineer
# your company information
company:
  name: Example Co.
  url: "https://www.example.com"

# your resume. this file path should be relative to you "static" directory
resume: "files/resume.pdf"

# a summary about you
summary: 'I am a passionate software engineer with x years of working experience. I built OSS tools for [Kubernetes](https://kubernetes.io/) using GO. My tools help people to deploy their workloads in Kubernetes. Sometimes, I work on some fun projects such as writing a theme, etc.'

# your social links
# give as many as you want. use font-awesome for the icons.
socialLinks:
- name: Email
  icon: "fas fa-envelope"
  url: "example@gmail.com"

- name: Github
  icon: "fab fa-github"
  url: "https://www.github.com/example"

- name: Stackoverflow
  icon: "fab fa-stack-overflow"
  url: "#"

- name: LinkedIn
  icon: "fab fa-linkedin"
  url: "#"

- name: Twitter
  icon: "fab fa-twitter"
  url: "#"

- name: Facebook
  icon: "fab fa-facebook"
  url: "#"

# Show your badges
# You can show your verifiable certificates from https://www.credly.com.
# You can also show a circular bar indicating the level of expertise on a certain skill
badges:
- type: certification
  name: Certified Kubernetes Security Specialist
  url: "https://www.credly.com/org/the-linux-foundation/badge/exam-developer-certified-kubernetes-security-specialist"
  badge: "https://images.credly.com/size/680x680/images/f4bf92ed-8985-40b2-bc07-2f9308780854/kubernetes-security-specialist-logo-examdev.png"

- type: certification
  name: Istio and IBM Cloud Kubernetes Service
  url: "https://www.credly.com/org/the-linux-foundation/badge/exam-developer-certified-kubernetes-security-specialist"
  badge: "https://images.credly.com/size/680x680/images/8d34d489-84bf-4861-a4a0-9e9d68318c5c/Beyond_basics_of_Istio_on_Cloud_v2.png"

- type: certification
  name: Artificial Intelligence and Machine Learning
  url: "https://www.credly.com/org/grupo-bancolombia/badge/artificial-intelligence-and-machine-learning"
  badge: "https://images.credly.com/size/680x680/images/e027514f-9d07-4b29-862f-fe21a8aaebf1/ae.png"

- type: soft-skill-indicator
  name: Leadership
  percentage: 85
  color: blue

- type: soft-skill-indicator
  name: Team Work
  percentage: 90
  color: yellow

- type: soft-skill-indicator
  name: Hard Working
  percentage: 85
  color: orange
```