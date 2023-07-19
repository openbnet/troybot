from __future__ import annotations
import logging
from typing import Any, Text, Dict, List, Type

from autocorrect import Speller
from rasa.engine.recipes.default_recipe import DefaultV1Recipe
from rasa.engine.graph import ExecutionContext, GraphComponent
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.shared.nlu.training_data.message import Message
from rasa.shared.nlu.constants import (
    TEXT,
)

logger = logging.getLogger(__name__)


@DefaultV1Recipe.register(DefaultV1Recipe.ComponentType.ENTITY_EXTRACTOR, is_trainable=False)
class Autocorrect(GraphComponent):
    def __init__(
        self,
        spell_corrector: Speller = None,
    ) -> None:
        self.spell_corrector = spell_corrector or Speller(lang='en')

    @staticmethod
    def required_packages() -> List[Text]:
        return ["autocorrect"]

    def process(self, messages: List[Message]) -> List[Message]:
        for message in messages:
            text = message.get(TEXT)
            corrected_text = self.spell_corrector(text)
            message.set(TEXT, corrected_text)

        return messages

    @classmethod
    def create(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
    ) -> GraphComponent:
        return cls()
