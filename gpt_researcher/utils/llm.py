# libraries
from __future__ import annotations

import logging
from typing import Any

from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate

from gpt_researcher.llm_provider.generic.base import NO_SUPPORT_TEMPERATURE_MODELS, SUPPORT_REASONING_EFFORT_MODELS, ReasoningEfforts

from ..prompts import PromptFamily
from .costs import estimate_llm_cost
from .validators import Subtopics
import os
import logging
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage


OPENROUTER_MODELS = ["deepseek/deepseek-chat-v3-0324", "meta-llama/llama-3.3-70b-instruct"]


def get_llm(llm_provider, **kwargs):
    from gpt_researcher.llm_provider import GenericLLMProvider
    return GenericLLMProvider.from_provider(llm_provider, **kwargs)


async def create_chat_completion(
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float | None = 0.4,
        max_tokens: int | None = 4000,
        llm_provider: str | None = None,
        stream: bool = False,
        websocket: Any | None = None,
        llm_kwargs: dict[str, Any] | None = None,
        cost_callback: callable = None,
        reasoning_effort: str | None = ReasoningEfforts.Medium.value
) -> str:
    """Create a chat completion using the OpenAI API
    Args:
        messages (list[dict[str, str]]): The messages to send to the chat completion.
        model (str, optional): The model to use. Defaults to None.
        temperature (float, optional): The temperature to use. Defaults to 0.4.
        max_tokens (int, optional): The max tokens to use. Defaults to 4000.
        llm_provider (str, optional): The LLM Provider to use.
        stream (bool): Whether to stream the response. Defaults to False.
        webocket (WebSocket): The websocket used in the currect request,
        llm_kwargs (dict[str, Any], optional): Additional LLM keyword arguments. Defaults to None.
        cost_callback: Callback function for updating cost.
        reasoning_effort (str, optional): Reasoning effort for OpenAI's reasoning models. Defaults to 'low'.
    Returns:
        str: The response from the chat completion.
    """
    # validate input
    if model is None:
        raise ValueError("Model cannot be None")
    if max_tokens is not None and max_tokens > 32001:
        raise ValueError(
            f"Max tokens cannot be more than 16,000, but got {max_tokens}")

    # Get the LLM provider from supported providers
    kwargs = {
        'model': model,
        **(llm_kwargs or {})
    }

    if model in SUPPORT_REASONING_EFFORT_MODELS:
        kwargs['reasoning_effort'] = reasoning_effort

    if model not in NO_SUPPORT_TEMPERATURE_MODELS:
        kwargs['temperature'] = temperature
        kwargs['max_tokens'] = max_tokens
    else:
        kwargs['temperature'] = None
        kwargs['max_tokens'] = None

    # Handle specific provider configurations
    if llm_provider in ["openai", "azure_openai"]:
        base_url = os.environ.get(f"{llm_provider.upper()}_BASE_URL", None)
        if base_url:
            kwargs[f'{llm_provider}_api_base'] = base_url
            
    # Check if the model is one of the openrouter models
    if model in OPENROUTER_MODELS:
      # Set up the client for openrouter
        kwargs['openai_api_base'] = "https://openrouter.ai/api/v1"
        kwargs['openai_api_key'] = os.environ.get("OPENROUTER_API_KEY")
        kwargs['extra_headers'] = {
                "HTTP-Referer": os.environ.get("YOUR_SITE_URL", None),  # Optional. Site URL for rankings on openrouter.ai.
                "X-Title": os.environ.get("YOUR_SITE_NAME", None),  # Optional. Site title for rankings on openrouter.ai.
            }

    # Get the actual provider
    provider = get_llm(llm_provider, **kwargs)
    response = ""
    # create response
    for _ in range(10):  # maximum of 10 attempts
        response = await provider.get_chat_response(
            messages, stream, websocket
        )

        if cost_callback:
            llm_costs = estimate_llm_cost(str(messages), response)
            cost_callback(llm_costs)

        return response

    logging.error(f"Failed to get response from {llm_provider} API")
    raise RuntimeError(f"Failed to get response from {llm_provider} API")


async def construct_subtopics(
    task: str,
    data: str,
    config,
    subtopics: list = [],
    prompt_family: type[PromptFamily] | PromptFamily = PromptFamily,
) -> list:
    """
    Construct subtopics based on the given task and data.

    Args:
        task (str): The main task or topic.
        data (str): Additional data for context.
        config: Configuration settings.
        subtopics (list, optional): Existing subtopics. Defaults to [].
        prompt_family (PromptFamily): Family of prompts

    Returns:
        list: A list of constructed subtopics.
    """
    try:
        parser = PydanticOutputParser(pydantic_object=Subtopics)

        prompt = PromptTemplate(
            template=prompt_family.generate_subtopics_prompt(),
            input_variables=["task", "data", "subtopics", "max_subtopics"],
            partial_variables={
                "format_instructions": parser.get_format_instructions()},
        )

        kwargs = {
            'model': config.smart_llm_model,
            **(config.llm_kwargs or {})
        }

        if config.smart_llm_model in SUPPORT_REASONING_EFFORT_MODELS:
            kwargs['reasoning_effort'] = ReasoningEfforts.High.value
        else:
            kwargs['temperature'] = config.temperature
            kwargs['max_tokens'] = config.smart_token_limit

        provider = get_llm(config.smart_llm_provider, **kwargs)

        model = provider.llm

        chain = prompt | model | parser

        output = chain.invoke({
            "task": task,
            "data": data,
            "subtopics": subtopics,
            "max_subtopics": config.max_subtopics
        })

        return output

    except Exception as e:
        print("Exception in parsing subtopics : ", e)
        return subtopics
