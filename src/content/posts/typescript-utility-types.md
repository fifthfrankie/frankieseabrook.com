---
title: "Practical TypeScript: Utility Types You'll Actually Use"
description: "A guide to the most useful TypeScript utility types with real-world examples. Learn how to use Pick, Omit, Partial, and more."
date: 2024-02-10
tags: ["typescript", "programming"]
---

TypeScript's utility types are incredibly powerful, but the official documentation can be a bit abstract. Let's look at the ones you'll actually use in day-to-day development, with practical examples.

## Partial<T>

Makes all properties optional. Perfect for update functions where you only want to change specific fields.

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

function updateUser(id: string, updates: Partial<User>) {
  // updates can have any subset of User properties
  return db.users.update(id, updates);
}

// Valid calls:
updateUser("123", { name: "New Name" });
updateUser("123", { email: "new@email.com", avatar: "/new-avatar.jpg" });
```

## Pick<T, K>

Creates a type with only the specified properties. Useful for creating DTOs or component props.

```typescript
interface Article {
  id: string;
  title: string;
  content: string;
  author: User;
  publishedAt: Date;
  tags: string[];
}

// For a list view, we only need a subset
type ArticlePreview = Pick<Article, "id" | "title" | "publishedAt">;

function ArticleCard({ article }: { article: ArticlePreview }) {
  return (
    <a href={`/articles/${article.id}`}>
      <h2>{article.title}</h2>
      <time>{article.publishedAt.toLocaleDateString()}</time>
    </a>
  );
}
```

## Omit<T, K>

The opposite of Pick - creates a type with specified properties removed.

```typescript
interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

// When returning user data, we never want to include the password
type UserResponse = Omit<User, "password">;

function createUser(input: CreateUserInput): UserResponse {
  const user = db.users.create(input);
  const { password, ...safeUser } = user;
  return safeUser;
}
```

## Record<K, V>

Creates an object type with keys of type K and values of type V. Great for dictionaries and lookup tables.

```typescript
type Status = "pending" | "active" | "completed" | "cancelled";

const statusLabels: Record<Status, string> = {
  pending: "Pending Review",
  active: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusColors: Record<Status, string> = {
  pending: "#fbbf24",
  active: "#3b82f6",
  completed: "#22c55e",
  cancelled: "#ef4444",
};
```

## ReturnType<T>

Extracts the return type of a function. Useful when working with third-party libraries or complex functions.

```typescript
function fetchUserData() {
  return {
    user: { id: "1", name: "John" },
    permissions: ["read", "write"],
    lastLogin: new Date(),
  };
}

// Instead of manually typing this complex return type:
type UserData = ReturnType<typeof fetchUserData>;

function processUserData(data: UserData) {
  console.log(data.user.name);
  console.log(data.permissions);
}
```

## NonNullable<T>

Removes `null` and `undefined` from a type. Essential for working with optional data.

```typescript
function getConfig(key: string): string | null {
  return process.env[key] ?? null;
}

function requireConfig(key: string): NonNullable<ReturnType<typeof getConfig>> {
  const value = getConfig(key);
  if (value === null) {
    throw new Error(`Missing required config: ${key}`);
  }
  return value;
}
```

## Combining Utility Types

The real power comes from combining these types:

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  inventory: number;
  createdAt: Date;
  updatedAt: Date;
}

// For creating a new product, omit auto-generated fields and make everything required
type CreateProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;

// For updating, everything is optional except id
type UpdateProductInput = Partial<Omit<Product, "id" | "createdAt">> & {
  id: string;
};

// For a price list, we only need specific fields
type PriceListItem = Pick<Product, "id" | "name" | "price">;
```

## Wrapping Up

These utility types might seem like small conveniences, but they add up to significantly cleaner and more maintainable code. They let you derive types from existing ones instead of duplicating definitions, which means when your base types change, derived types update automatically.

The TypeScript documentation has a full list of utility types, but these are the ones I reach for most often. Start incorporating them into your code, and you'll wonder how you ever lived without them.
