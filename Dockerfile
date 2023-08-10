FROM node:18-alpine
RUN apk update && apk add git

# Set the working directory inside the container
WORKDIR /app
# Copy the source code to the container
COPY ./*.json /app
COPY ./common /app/common
COPY ./src /app/src
COPY ./client /app/client
# Install dependencies
RUN npm install
# Build the TypeScript code
# RUN npm run build

# Expose the port that the action server will run on
EXPOSE 5055

# Start the action server
CMD [ "npm", "run", "actionServer" ]