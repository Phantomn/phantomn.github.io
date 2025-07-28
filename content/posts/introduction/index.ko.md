---
title: 사이트 준비하기
date: 2020-06-08T00:00:00Z
draft: false
hero: hero.svg
lang: ko
---

이 게시물에서는 Hugo 사이트를 처음부터 만들 것입니다. 그런 다음 Toha 테마로 구성하고, 다국어 사이트로 만들고, 몇 가지 예시 게시물을 추가할 것입니다. 이 게시물 끝에는 Toha 테마로 완전히 작동하는 Hugo 사이트를 로컬에서 실행할 수 있을 것입니다.

빠른 시작을 원한다면, [hugo-toha/hugo-toha.github.io](https://github.com/hugo-toha/hugo-toha.github.io) 저장소를 포크하고 이름을 변경한 다음 자신의 데이터로 업데이트할 수 있습니다. 이 저장소는 이미 GitHub Pages 및 Netlify에 배포되도록 구성되어 있습니다.

## 저장소 생성

먼저 GitHub에 저장소를 만드세요. GitHub Pages에 이 사이트를 배포하려면 저장소 이름이 `<사용자 이름>.github.io`여야 합니다. 저장소를 로컬 머신에 복제하고 해당 디렉토리로 이동하세요.

## 사이트 생성

이제 Hugo가 설치되어 있는지 확인하세요. 이 테마는 Hugo 버전 `v0.118.0` 이상에서 작동해야 합니다. 이제 저장소의 루트에서 다음 명령을 실행하여 Hugo 웹사이트를 초기화하세요.

```bash
hugo new site ./ --format=yaml --force
```

이 명령은 기본적인 Hugo 사이트 구조를 생성합니다. 여기서 `--format=yaml` 플래그는 Hugo에게 YAML 형식으로 구성 파일을 만들도록 지시하고, `--force` 플래그는 대상 디렉토리가 비어 있지 않더라도 Hugo가 사이트를 강제로 생성하도록 합니다. 이 명령은 사이트에 필요한 모든 구성을 담을 `hugo.yaml` 파일을 생성합니다.

## 테마 추가

Hugo 모듈을 사용하여 Toha 테마를 사이트에 추가할 것입니다. 먼저 다음 명령을 사용하여 Hugo 모듈을 초기화하세요.

```bash
hugo mod init github.com/<사용자 이름>/<저장소 이름>
```

이 명령은 저장소의 루트에 `go.mod` 파일을 생성합니다.

그런 다음 `hugo.yaml` 파일에 다음 모듈 섹션을 추가하세요.

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

마지막으로 다음 명령을 실행하여 테마 및 종속성을 다운로드하세요.

```bash
# 테마 다운로드
hugo mod get -u
# 테마의 종속성 다운로드
hugo mod tidy
# 노드 종속성 생성
hugo mod npm pack
# 종속성 설치
npm install
```

## 로컬에서 사이트 실행

이제 로컬에서 사이트를 실행할 수 있습니다. 다음 명령을 사용하여 감시 모드로 사이트를 실행해 봅시다.

```bash
hugo server -w
```

`http://localhost:1313`으로 이동하면 Toha 테마가 적용된 기본적인 사이트를 볼 수 있습니다. 다음 섹션에서는 `hugo-toha.github.io`처럼 보이도록 사이트를 구성할 것입니다. 감시 모드로 서버를 실행했으므로, 사이트에 변경 사항을 적용하면 브라우저에 즉시 반영됩니다.

## 사이트 구성

이제 사이트를 구성할 준비가 되었습니다. 이 섹션에서는 작성자 정보, 다양한 섹션 및 샘플 게시물 등을 추가할 것입니다.

### HUGO.YAML 업데이트

`hugo new site` 명령을 사용하여 사이트를 만들었을 때, 저장소의 루트에 `hugo.yaml` 파일이 생성되었습니다. `hugo.yaml` 파일의 기본 내용을 다음으로 바꾸세요.

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

### 데이터 추가

이 테마의 대부분의 콘텐츠는 `data` 디렉토리의 YAML 파일에 의해 구동됩니다. 이 섹션에서는 몇 가지 샘플 데이터를 추가할 것입니다. 다국어 사이트를 구축하고 있으므로, 각 언어에 대한 데이터를 자체 로케일 폴더에 분리하여 보관할 것입니다.

At first, create `en` folder inside your `data` directory. We are going to add data for English language here.

#### 사이트 정보

Now, create a `site.yaml` file inside `/data/en/` directory of your repository. Add the following content there:

```yaml
# 저작권 고지
copyright: © 2020 Copyright.

# 사이트의 메타 설명. 검색 엔진이 사이트를 찾는 데 도움이 됩니다.
description: John Doe의 포트폴리오 및 개인 블로그.
```

To see all the available options for site information, check [this sample file](https://github.com/hugo-toha/hugo-toha.github.io/blob/main/data/en/site.yaml).

#### 작성자 정보

Now, create a `author.yaml` file in `/data/en/` directory and add your information there as below:

```yaml
# 당신에 대한 정보
name: "John Doe"
nickname: "John"
# 당신의 이름 앞에 표시될 인사말. 제공되지 않으면 "Hi! I am"으로 기본 설정됩니다.
greeting: "Hi, I am"
image: "images/author/john.png"
# give your some contact information. they will be used in the footer
contactInfo:
  email: "johndoe@example.com"
  phone: "+0123456789"
  github: johndoe
  linkedin: johndoe

# 당신이 하는 일에 대한 요약
summary:
  - I am a Developer
  - I am a Devops
  - I love servers
  - I work on open-source projects
  - I love to work with some fun projects
```

### 섹션 추가

Now, we are going to add different sections into our home page. At first, create a `sections` folder inside your `/data/en` directory. Here, we are going to add few sections with minimum configurations. In order to see detailed configuration options for the sections, please visit [here](https://toha-guides.netlify.app/posts/configuration/).

#### ABOUT 섹션

Create `about.yaml` file inside your `/data/en/sections/` directory. Then add the following contents there:

```yaml
# 섹션 정보
section:
  name: About
  id: about
  enable: true
  weight: 1
  showOnNavbar: true
  template: sections/about.html

# 당신의 직책
designation: 소프트웨어 엔지니어
# 당신의 회사 정보
company:
  name: 예시 회사
  url: "https://www.example.com"

# 당신의 이력서. 이 파일 경로는 "static" 디렉토리에 상대적이어야 합니다.
resume: "files/resume.pdf"

# 당신에 대한 요약
summary: 'I am a passionate software engineer with x years of working experience. I built OSS tools for [Kubernetes](https://kubernetes.io/) using GO. My tools help people to deploy their workloads in Kubernetes. Sometimes, I work on some fun projects such as writing a theme, etc.'

# 당신의 소셜 링크
# 원하는 만큼 추가하세요. 아이콘은 font-awesome을 사용하세요.
socialLinks:
- name: 이메일
  icon: "fas fa-envelope"
  url: "example@gmail.com"

- name: 깃허브
  icon: "fab fa-github"
  url: "https://www.github.com/example"

- name: 스택오버플로우
  icon: "fab fa-stack-overflow"
  url: "#"

- name: 링크드인
  icon: "fab fa-linkedin"
  url: "#"

- name: 트위터
  icon: "fab fa-twitter"
  url: "#"

- name: 페이스북
  icon: "fab fa-facebook"
  url: "#"

# 당신의 배지를 보여주세요
# https://www.credly.com에서 검증 가능한 인증서를 보여줄 수 있습니다.
# 특정 기술에 대한 전문성 수준을 나타내는 원형 막대를 보여줄 수도 있습니다.
badges:
- type: certification
  name: 공인 쿠버네티스 보안 전문가
  url: "https://www.credly.com/org/the-linux-foundation/badge/exam-developer-certified-kubernetes-security-specialist"
  badge: "https://images.credly.com/size/680x680/images/f4bf92ed-8985-40b2-bc07-2f9308780854/kubernetes-security-specialist-logo-examdev.png"

- type: certification
  name: Istio 및 IBM Cloud Kubernetes 서비스
  url: "https://www.credly.com/org/the-linux-foundation/badge/exam-developer-certified-kubernetes-security-specialist"
  badge: "https://images.credly.com/size/680x680/images/8d34d489-84bf-4861-a4a0-9e9d68318c5c/Beyond_basics_of_Istio_on_Cloud_v2.png"

- type: certification
  name: 인공지능 및 머신러닝
  url: "https://www.credly.com/org/grupo-bancolombia/badge/artificial-intelligence-and-machine-learning"
  badge: "https://images.credly.com/size/680x680/images/e027514f-9d07-4b29-862f-fe21a8aaebf1/ae.png"

- type: soft-skill-indicator
  name: 리더십
  percentage: 85
  color: blue

- type: soft-skill-indicator
  name: 팀워크
  percentage: 90
  color: yellow

- type: soft-skill-indicator
  name: 성실성
  percentage: 85
  color: orange
```