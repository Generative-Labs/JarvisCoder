import { API_BASE_URL } from '../configs';
import { Message } from '../types/chats';
import { fetchWithToken } from '../utils/requestInterceptor';

/**
 * Generic API response interface
 * @template T - Type of the data in the response
 */
interface ApiResponse<T> {
  /** Whether the API call was successful */
  success: boolean;
  /** Response data if successful */
  data?: T;
  /** Error message if the call failed */
  error?: string;
}

// Flag to toggle between mock and real API calls
export const USE_MOCK_API = false; // Changed to true for development with mocks

/**
 * Interface for message responses from the chat API
 */
export interface MessageResponse {
  /** Type of the message response */
  type: 'message' | 'error' | 'done' | 'start' | 'failed' | 'exception';
  /** Message data if type is 'message' */
  data?: Message;
  /** Error message if type is 'error' */
  error?: string;
}


export async function mockChatStream(
  onMessage: (response: MessageResponse) => void
): Promise<void> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const mockString = "Okay, I can help you modify the prompt to achieve the desired output flow when the AI is tasked with creating a new proje";

  const timestamp = Date.now();
  const mockResponses = [];
  const length = 500;
  for (let i = 0; i < mockString.length; i += length) {
    mockResponses.push({
      content: mockString.slice(i, i + length),
      delay: 500,
    });
  }
  for (const response of mockResponses) {
    await new Promise((resolve) => setTimeout(resolve, response.delay));
    onMessage({
      type: "message",
      data: {
        text: response.content,
        isUser: false,
        type: "normal",
        timestamp: timestamp,
      },
    });
  }
  // Send completion signal
  onMessage({
    type: "done",
  });
}
/**
 * Sends a message to the chat API and handles the streaming response.
 * Implements retry logic for failed requests.
 *
 * @param {Object} payload - The message payload
 * @param {string} payload.message - The message text to send
 * @param {string} payload.session_id - The session ID for the chat
 * @param {string} payload.model_name - The model name to use for the chat
 * @param {string[]} [payload.code_context] - Optional array of file paths to use as code context
 * @param {Function} onMessage - Callback function to handle incoming message chunks
 * @param {AbortSignal} [signal] - Optional AbortSignal to cancel the request
 * @returns {Promise<void>} A promise that resolves when the message exchange is complete
 * @throws {Error} If the maximum number of retries is exceeded
 */
export async function sendMessageAction(
  payload: {
    message: string;
    session_id: string;
    model_name: string;
    code_context?: string[];
  },
  onMessage: (response: MessageResponse) => void,
  signal?: AbortSignal,
): Promise<void> {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        body: JSON.stringify(payload),
        signal,
      });
      if (!response.ok || !response.body) {
        await onMessage({
          type: 'failed',
          data: {
            text: 'Server is busy, please try again later',
            isUser: false,
            type: 'normal',
            timestamp: Date.now(),
          },
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onMessage({
            type: 'done',
          });
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim();
            try {
              const parsed = JSON.parse(dataStr);
              onMessage({
                type: 'message',
                data: {
                  text: parsed.token,
                  isUser: false,
                  type: 'normal',
                  timestamp: Date.now(),
                },
              });
            } catch (_e) {
              const parsed = dataStr.trim().substring(11, dataStr.length - 1);
              onMessage({
                type: 'message',
                data: {
                  text: parsed,
                  isUser: false,
                  type: 'normal',
                  timestamp: Date.now(),
                },
              });
            }
          }
        }
      }
      break;
    } catch (error) {
      // check if the error is an abort error
      if (error instanceof Error && error.name === 'AbortError') {
        onMessage({
          type: 'done',
        });
        return;
      }
      retryCount++;
      if (retryCount < maxRetries) {
        // send retry message to user
        onMessage({
          type: 'error',
          error: `connection error, retrying (${retryCount + 1}/${maxRetries})`,
        });
        // wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      } else {
        await onMessage({
          type: 'failed',
          data: {
            text: 'Server is busy, please try again later',
            isUser: false,
            type: 'normal',
            timestamp: Date.now(),
          },
        });
        return;
      }
    }
  }
}
/**
 * Sends a message to the chat API and handles the streaming response.
 * Implements retry logic for failed requests.
 *
 * @template T - The type of the message data
 * @param {Object} payload - The message payload
 * @param {string} payload.message - The message text to send
 * @param {string} payload.session_id - The session ID for the chat
 * @param {Function} onMessage - Callback function to handle incoming message chunks
 * @param {AbortSignal} [signal] - Optional AbortSignal to cancel the request
 * @returns {Promise<void>} A promise that resolves when the message exchange is complete
 * @throws {Error} If the maximum number of retries is exceeded
 */
export async function sendMessageActionBack(
  payload: {
    message: string;
    session_id: string;
  },
  onMessage: (response: MessageResponse) => void,
  signal?: AbortSignal,
): Promise<void> {
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const response = await fetchWithToken(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        await onMessage({
          type: 'failed',
          data: {
            text: 'Server is busy, please try again later',
            isUser: false,
            type: 'normal',
            timestamp: Date.now(),
          },
        });
      }

      const timestamp = Date.now();
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      // Remove unused message variable

      try {
        while (true) {
          const readRes = await reader?.read();
          if (readRes?.done) {
            onMessage({
              type: 'done',
            });
            break;
          }
          const line = decoder.decode(readRes?.value, { stream: true });

          let processedLine = line;
          if (line.startsWith('event: error')) {
            if (line.includes('event: end')) {
              const dataArr = line.split('event: end');
              processedLine = dataArr[0].trim();
            }
            const strArr = processedLine.split('event: error');
            const dataStr = strArr[1].replace(/^(event: error|data:)\s*/, '').trim();
            const error = JSON.parse(dataStr);
            await onMessage({
              type: 'failed',
              data: {
                text: error.error.message || 'Server is busy, please try again later',
                isUser: false,
                type: 'normal',
                timestamp: timestamp,
              },
            });
            return;
          }

          if (line.trim() === '') {
            continue;
          }

          if (line.startsWith('event: chunk') || line.startsWith('data:')) {
            const strArr = line.split('event: chunk');

            try {
              await Promise.all(
                strArr.map(async (element) => {
                  let readyElement = element;
                  if (element.trimStart().startsWith('data:') && element.includes('event: end')) {
                    readyElement = element.trimStart().split('event: end')[0];
                  }
                  const dataStr = readyElement.replace(/^(event: chunk|data:)\s*/, '').trim();
                  const readyParaseStr = dataStr.replace(/^(event: chunk|data:)\s*/, '').trim();

                  if (readyParaseStr.startsWith('event: end')) {
                    return;
                  }

                  if (!readyParaseStr) {
                    return;
                  }

                  try {
                    // Parse the JSON data
                    const data = JSON.parse(readyParaseStr);

                    if (data.token) {
                      await onMessage({
                        type: 'message',
                        data: {
                          text: data.token,
                          isUser: false,
                          type: 'normal',
                          timestamp: timestamp,
                        },
                      });
                    }
                  } catch (_error) {
                    // If parsing fails, check if it's an end event
                    if (readyParaseStr.includes('event: end')) {
                      return;
                    }
                    // For non-JSON messages, send as-is
                    await onMessage({
                      type: 'message',
                      data: {
                        text: readyParaseStr,
                        isUser: false,
                        type: 'normal',
                        timestamp: timestamp,
                      },
                    });
                  }
                }),
              );
            } catch (_error) {
              // Log error to error channel instead of console
              continue;
            }
          }
        }
        // Message is already sent via onMessage, no need to log it here

        break;
      } catch (streamError: unknown) {
        // check if the error is an abort error
        if (streamError instanceof Error && streamError.name === 'AbortError') {
          onMessage({
            type: 'done',
          });
          return;
        }
        // if stream error, try to retry
        retryCount++;
        if (retryCount < maxRetries) {
          // send retry message to user
          onMessage({
            type: 'error',
            error: `connection error, retrying (${retryCount + 1}/${maxRetries})`,
          });
          // wait and retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
          continue;
        } else {
          await onMessage({
            type: 'failed',
            data: {
              text: 'Server is busy, please try again later',
              isUser: false,
              type: 'normal',
              timestamp: timestamp,
            },
          });
          throw streamError;
        }
      }
    } catch (error: unknown) {
      // check if the error is an abort error
      if (error instanceof Error && error.name === 'AbortError') {
        onMessage({
          type: 'done',
        });
        return;
      }
      retryCount++;
      if (retryCount < maxRetries) {
        // send retry message to user
        onMessage({
          type: 'error',
          error: `connection error, retrying (${retryCount + 1}/${maxRetries})`,
        });
        // wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      } else {
        await onMessage({
          type: 'failed',
          data: {
            text: 'Server is busy, please try again later',
            isUser: false,
            type: 'normal',
            timestamp: Date.now(),
          },
        });
        return;
      }
    }
  }
}

/**
 * Interface for model parameters
 */
interface ModelParameters {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Interface representing the response from opening a new chat session.
 */
export interface OpenChatResponse {
  /** A message describing the result of the operation */
  message: string;

  /** Error message if the operation failed */
  error: string;

  /** Status code of the response */
  code: number;

  /** The unique session ID for the new chat session */
  session_id: string;

  /** The name of the AI model being used for the chat */
  model_name: string;

  /** Configuration parameters for the AI model */
  model_parameters: ModelParameters;
}

/**
 * Opens a new chat session for the specified user.
 *
 * @param {string} userId - The unique identifier of the user opening the chat
 * @returns {Promise<OpenChatResponse | null>} A promise that resolves to the chat session details,
 *          or null if the operation fails
 * @throws {Error} If there's an error during the API call
 */
export async function openChatAction(userId: string): Promise<OpenChatResponse | null> {
  try {
    const response = await fetchWithToken(`${API_BASE_URL}/chat/open`, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({
        user: userId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (_error) {
    // Log error to error channel
    // Error is already handled by onMessage if provided
    return null;
  }
}

//
/**
 * Interface for experiment data
 */
export interface ExperimentData {
  /**
   *
   */
  id?: string | number;
  /**
   *
   */
  user: string;
  /**
   *
   */
  title: string;
  /**
   *
   */
  model_name: string;
  /**
   *
   */
  model_version?: string;
  /**
   *
   */
  model_parameters?: ModelParameters;
  /**
   *
   */
  raw_input: string;
  /**
   *
   */
  raw_output: string;
  /**
   *
   */
  evaluation_metrics?: Record<string, unknown>;
  /**
   *
   */
  status: string;
  /**
   *
   */
  tags?: string[];
  /**
   *
   */
  notes?: string;
  /**
   *
   */
  references?: {
    prompt_id?: number;
    input_dataset_ids?: number[];
    context_ids?: number[];
  };
  /**
   *
   */
  prompt_id?: number;
  /**
   *
   */
  input_dataset_ids?: number[];
  /**
   *
   */
  context_ids?: number[];
  /**
   *
   */
  created_at?: string;
  /**
   *
   */
  updated_at?: string;
}

/**
 * Interface representing the response from creating a new experiment.
 */
export interface CreateExperimentResponse {
  /** The unique identifier of the created experiment */
  experiment_id: number | string;

  /** A message describing the result of the operation */
  message: string;
}
/**
 * Creates a new experiment with the provided data.
 *
 * @param {ExperimentData} experimentData - The experiment data to create
 * @returns {Promise<ApiResponse<CreateExperimentResponse>>} A promise that resolves to the API response
 *          containing the created experiment ID and status message
 * @throws {Error} If there's an error during the API call or if the response is not ok
 */
export async function createExperiment(
  experimentData: ExperimentData,
): Promise<ApiResponse<CreateExperimentResponse>> {
  // Use mock implementation if flag is set
  try {
    const response = await fetchWithToken(`${API_BASE_URL}/experiments`, {
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify(experimentData),
    });

    if (!response.ok) {
      return {
        success: false,
        error: response.statusText ? response.statusText : 'Unknown error creating experiment',
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    // Error is already handled by the calling function
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating experiment',
    };
  }
}

/**
 * Retrieves all experiments associated with a specific user.
 *
 * @param {string} userId - The unique identifier of the user whose experiments to retrieve
 * @returns {Promise<ApiResponse<ExperimentData[]>>} A promise that resolves to an API response
 *          containing an array of experiment data objects
 * @throws {Error} If there's an error during the API call or if the response is not ok
 */
export async function getUserExperiments(userId: string): Promise<ApiResponse<ExperimentData[]>> {
  try {
    const response = await fetchWithToken(`${API_BASE_URL}/users/${userId}/experiments`, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    // Error is already handled by the calling function
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching experiments',
    };
  }
}

/**
 * Interface representing the detailed response for an experiment.
 * Contains comprehensive information about a specific experiment.
 */
export interface ExperimentDetailResponse {
  /** Unique identifier for the experiment */
  id: number;

  /** Title of the experiment */
  title: string;

  /** Name of the AI model used in the experiment */
  model_name: string;

  /** Version of the AI model */
  model_version: string | null;

  /** Configuration parameters used for the AI model */
  model_parameters: {
    /** Temperature setting for model generation */
    temperature: number;

    /** Maximum number of tokens to generate */
    max_token: number | null;
  };

  /** Temperature setting (duplicate of model_parameters.temperature) */
  temperature: number;

  /** Maximum token limit (duplicate of model_parameters.max_token) */
  max_token: number | null;

  /** Current status of the experiment (e.g., 'completed', 'failed') */
  status: string;

  /** Array of tags associated with the experiment */
  tags: string[];

  /** Additional notes or description about the experiment */
  notes: string;

  /** Evaluation metrics and results */
  evaluation_metrics: Record<string, unknown>;

  /** Raw input data used in the experiment */
  raw_input: string;

  /** Raw output data generated by the experiment */
  raw_output: string;

  /** Timestamp when the experiment was created */
  created_at: string;

  /** Timestamp when the experiment was last updated */
  updated_at: string;

  /** ID of the prompt used in the experiment */
  prompt_id: number;
}

/**
 * Retrieves detailed information about a specific experiment.
 *
 * @param {string} userId - The unique identifier of the user who owns the experiment
 * @param {number} experimentId - The unique identifier of the experiment to retrieve
 * @returns {Promise<ApiResponse<ExperimentDetailResponse>>} A promise that resolves to an API response
 *          containing the detailed experiment data
 * @throws {Error} If there's an error during the API call or if the response is not ok
 */
export async function getExperimentsDetail(
  userId: string,
  experimentId: number,
): Promise<ApiResponse<ExperimentDetailResponse>> {
  try {
    const response = await fetchWithToken(
      // /users/{user_id}/experiments/{experiment_id}
      `${API_BASE_URL}/users/${userId}/experiments/${experimentId}`,
      {
        method: 'GET',
        mode: 'cors',
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    // Error is already handled by the calling function
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error fetching experiments',
    };
  }
}

/**
 * Updates an existing experiment with new data.
 *
 * @param {string} experimentId - The unique identifier of the experiment to update
 * @param {Object} experimentData - The experiment data to update
 * @param {string} experimentData.status - The new status of the experiment
 * @param {string[]} experimentData.tags - The updated tags for the experiment
 * @param {string} experimentData.notes - The updated notes for the experiment
 * @returns {Promise<ApiResponse<CreateExperimentResponse>>} A promise that resolves to an API response
 *          containing the updated experiment ID and status message
 * @throws {Error} If there's an error during the API call or if the response is not ok
 */
export async function updateExperiment(
  experimentId: string,
  experimentData: {
    status: string;
    tags: string[];
    notes: string;
  },
): Promise<ApiResponse<CreateExperimentResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}/experiments/${experimentId} `, {
      method: 'PATCH',
      mode: 'cors',
      body: JSON.stringify(experimentData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create experiment: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error) {
    // Error is already handled by the calling function
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating experiment',
    };
  }
}

/**
 * Interface representing the token response from the authentication server.
 * Contains the access token, refresh token, and expiration information.
 */
interface TokenResponse {
  /** The JWT access token used for authenticated requests */
  access_token: string;

  /** The refresh token used to obtain a new access token */
  refresh_token: string;

  /** The number of seconds until the access token expires */
  expires_in: number;
}

/**
 * Refreshes the authentication token using a valid refresh token.
 *
 * @param {string} refreshToken - The refresh token to use for obtaining a new access token
 * @param {Function} [onMessage] - Optional callback function to handle message responses
 * @returns {Promise<ApiResponse<TokenResponse>>} A promise that resolves to an API response
 *          containing the new access token, refresh token, and expiration information
 * @throws {Error} If there's an error during the token refresh process or if the response is not ok
 */
export async function refreshTokenAction(
  refreshToken: string,
): Promise<ApiResponse<TokenResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      },
    };
  } catch (error) {
    // Log error to error channel
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error refreshing token',
    };
  }
}
