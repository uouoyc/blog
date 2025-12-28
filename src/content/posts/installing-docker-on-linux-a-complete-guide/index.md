---
title: Linux安装Docker完整教程
published: 2025-08-09
description: "在Linux上快速安装Docker，包括了CentOS和Ubuntu的安装步骤，以及Docker-Compose和Docker-Registry的配置方法。"
image: "./cover.webp"
tags: ["linux", "docker", "docker compose", "docker registry"]
category: "学习笔记"
draft: false
---

## Docker 环境搭建

### CentOS 安装步骤

1. 卸载旧版本

```bash
sudo yum remove docker \
      docker-client \
      docker-client-latest \
      docker-common \
      docker-latest \
      docker-latest-logrotate \
      docker-logrotate \
      docker-engine
```

2. yum 安装 gcc 相关

```bash
sudo yum -y install gcc

sudo yum -y install gcc-c++
```

3. 安装需要的软件包

```bash
sudo yum install -y yum-utils

sudo yum-config-manager --add-repo http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
```

4. 更新 yum 软件包索引

```bash
sudo yum makecache fast
```

5. 安装 docker engine

```bash
sudo yum -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Ubuntu 安装步骤

1. 卸载旧版本

```bash
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove $pkg; done
```

2. 设置 docker 的 apt 存储库

```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

> 如果你使用 Ubuntu 衍生发行版，例如 Linux Mint，则可能需要使用 `UBUNTU_CODENAME` 而不是 `VERSION_CODENAME`

3. 更新 apt 软件包索引

```bash
sudo apt-get update
```

4. 安装 docker engine

```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 启动 Docker 服务

```bash
# 启动 docker
systemctl start docker

# 关闭 docker
systemctl stop docker

# 重启 docker
systemctl restart docker

# 自启 docker
systemctl enable docker
```

## Docker-Compose 容器编排工具

1. 运行以下命令可以安装 Docker Compose 的稳定版本：

```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
```

> 如果要安装其他版本，请替换 2.21.0 为要使用的版本

2. 将可执行权限应用于二进制文件：

```bash
sudo chmod +x /usr/local/bin/docker-compose
```

> 如果安装后命令失败可以创建指向 `/usr/bin` 或路径中任何其他目录的符号链接

```bash
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
```

3. 测试安装：

```bash
docker-compose --version
```

## Docker-Registry 私有仓库部署

> 访问页面：<http://ip:5000/v2/_catalog>

1. 运行以下命令来启动容器：

```bash
docker run -d --name registry \
      -p 5000:5000 \
      -v /data/registry:/usr/local/registry \
      --restart=unless-stopped \
      registry
```

2. 配置 Docker 以允许不安全的注册表并设置 cgroup 驱动程序（注意替换 ip 为本地 ip）：

```bash
vim /etc/docker/daemon.json
"insecure-registries":["registry.access.redhat.com","quay.io","ip:5000"],
"exec-opts":["native.cgroupdriver=systemd"],
"live-restore":true
```

3. 重启服务：

```bash
# 重新加载配置
systemctl daemon-reload

# 重启 docker
systemctl restart docker
```
