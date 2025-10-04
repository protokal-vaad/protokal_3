# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install --only=production

# Bundle app source
COPY . .

# Your app binds to port 8080 by default in Cloud Run, but we use the PORT env var
EXPOSE 8080

# Define the command to run your app
CMD [ "node", "server.js" ]