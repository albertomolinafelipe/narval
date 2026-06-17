#!/bin/bash

# Check if Umami is running
echo "Checking if Umami is running..."
if ! curl -sf http://localhost:3001/api/heartbeat > /dev/null 2>&1; then
  echo "Error: Umami is not running. Please run 'make dev' first."
  exit 1
fi

# Wait for Umami to be ready
echo "Umami is ready!"

# Login and get token
echo "Logging in to Umami..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login   -H "Content-Type: application/json"   -d '{"username":"admin","password":"umami"}'   | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo "Failed to login to Umami"
  exit 1
fi

echo "Logged in successfully!"

# Check if website already exists
WEBSITE_ID=$(curl -s -X GET http://localhost:3001/api/websites   -H "Authorization: Bearer $TOKEN"   | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')

if [ -n "$WEBSITE_ID" ]; then
  echo "Website already exists with ID: $WEBSITE_ID"
  echo ""
  
  # Update .env file for docker-compose
  ROOT_ENV_FILE=".env"
  if grep -q "^UMAMI_WEBSITE_ID=" "$ROOT_ENV_FILE" 2>/dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/^UMAMI_WEBSITE_ID=.*/UMAMI_WEBSITE_ID=$WEBSITE_ID/" "$ROOT_ENV_FILE"
    else
      sed -i "s/^UMAMI_WEBSITE_ID=.*/UMAMI_WEBSITE_ID=$WEBSITE_ID/" "$ROOT_ENV_FILE"
    fi
    echo "Updated $ROOT_ENV_FILE with Website ID"
  else
    echo "UMAMI_WEBSITE_ID=$WEBSITE_ID" >> "$ROOT_ENV_FILE"
    echo "Added Website ID to $ROOT_ENV_FILE"
  fi

  echo ""
  echo "✓ Umami setup complete!"
  exit 0
fi

# Create website
echo "Creating website..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/websites   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{
    "name": "Narval",
    "domain": "localhost",
    "shareId": null
  }')

WEBSITE_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')

if [ -z "$WEBSITE_ID" ]; then
  echo "Failed to create website"
  echo "Response: $RESPONSE"
  exit 1
fi

echo "Website created successfully!"
echo "Website ID: $WEBSITE_ID"
echo ""

# Update root .env (used by docker-compose)
ROOT_ENV_FILE=".env"
if grep -q "^UMAMI_WEBSITE_ID=" "$ROOT_ENV_FILE" 2>/dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^UMAMI_WEBSITE_ID=.*/UMAMI_WEBSITE_ID=$WEBSITE_ID/" "$ROOT_ENV_FILE"
  else
    sed -i "s/^UMAMI_WEBSITE_ID=.*/UMAMI_WEBSITE_ID=$WEBSITE_ID/" "$ROOT_ENV_FILE"
  fi
  echo "Updated $ROOT_ENV_FILE with Website ID"
else
  echo "UMAMI_WEBSITE_ID=$WEBSITE_ID" >> "$ROOT_ENV_FILE"
  echo "Added Website ID to $ROOT_ENV_FILE"
fi

# Update apps/web/.env.local if it exists (used when running web outside Docker)
ENV_FILE="apps/web/.env.local"
if [ -f "$ENV_FILE" ]; then
  if grep -q "UMAMI_WEBSITE_ID=" "$ENV_FILE"; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/UMAMI_WEBSITE_ID=.*/UMAMI_WEBSITE_ID=$WEBSITE_ID/" "$ENV_FILE"
    else
      sed -i "s/UMAMI_WEBSITE_ID=.*/UMAMI_WEBSITE_ID=$WEBSITE_ID/" "$ENV_FILE"
    fi
  else
    echo "UMAMI_WEBSITE_ID=$WEBSITE_ID" >> "$ENV_FILE"
    echo "UMAMI_URL=http://localhost:3001" >> "$ENV_FILE"
  fi
  echo "Updated $ENV_FILE with Website ID"
fi

echo ""
echo "✓ Umami setup complete!"
echo ""
echo "Recreating web container with updated env..."
docker compose --profile full up -d web
echo ""
echo "✓ Done. Umami analytics are now active!"
