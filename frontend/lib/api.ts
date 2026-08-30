const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (reason: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("refresh_token") || localStorage.getItem("refresh_token");
}

export async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  const data = await response.json();
  if (data.access_token) {
    if (sessionStorage.getItem("access_token")) {
      sessionStorage.setItem("access_token", data.access_token);
      if (data.refresh_token) sessionStorage.setItem("refresh_token", data.refresh_token);
    } else {
      localStorage.setItem("access_token", data.access_token);
      if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    }
    return data.access_token;
  }

  throw new Error("Invalid token response");
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };

  let response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes("/auth/refresh") && !endpoint.includes("/auth/login")) {
    if (isRefreshing) {
      try {
        const newToken = await new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        const newHeaders = {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        };
        response = await fetch(url, {
          ...options,
          headers: newHeaders,
        });
      } catch (err) {
        if (typeof window !== "undefined") {
          sessionStorage.clear();
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
        throw new Error("Unauthorized - Please log in again");
      }
    } else {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        processQueue(null, newToken);

        const newHeaders = {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        };
        response = await fetch(url, {
          ...options,
          headers: newHeaders,
        });
      } catch (refreshErr) {
        isRefreshing = false;
        processQueue(refreshErr, null);

        if (typeof window !== "undefined") {
          sessionStorage.clear();
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
        throw new Error("Unauthorized - Please log in again");
      }
    }
  }

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      sessionStorage.clear();
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
    }
    throw new Error("Unauthorized - Please log in again");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    let errorMessage = "An error occurred";
    
    if (typeof errorData.detail === "string") {
      errorMessage = errorData.detail;
    } else if (Array.isArray(errorData.detail)) {
      // FastAPI 422 validation errors array format [{ loc, msg, type }]
      errorMessage = errorData.detail
        .map((err: any) => {
          let field = err.loc ? err.loc[err.loc.length - 1] : "";
          let msg = err.msg || "Invalid value";

          if (msg.includes("value is not a valid email address") || field === "email") {
            return "Invalid email address format (e.g. user@example.com)";
          }

          // Clean up standard field names
          if (field && field !== "body") {
            const cleanField = field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, " ");
            return `${cleanField}: ${msg}`;
          }
          return msg;
        })
        .join("\n");
    } else if (errorData.detail && typeof errorData.detail === "object") {
      errorMessage = JSON.stringify(errorData.detail);
    } else if (errorData.message) {
      errorMessage = errorData.message;
    }

    throw new Error(errorMessage);
  }

  // Handle empty responses (like 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export async function forgotPassword(email: string): Promise<{ detail: string }> {
  return apiFetch<{ detail: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ detail: string }> {
  return apiFetch<{ detail: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}
