from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional, Text
from rasa.engine.recipes.default_recipe import DefaultV1Recipe
from rasa.engine.graph import ExecutionContext, GraphComponent
from rasa.engine.storage.resource import Resource
from rasa.engine.storage.storage import ModelStorage
from rasa.shared.nlu.training_data.message import Message
from rasa.shared.nlu.training_data.training_data import TrainingData
from thefuzz import process
from thefuzz import fuzz
from rasa.shared.utils.io import read_yaml_file
from rasa.shared.nlu.constants import (
    ENTITIES,
    TEXT
)
logger = logging.getLogger(__name__)


@DefaultV1Recipe.register(
    DefaultV1Recipe.ComponentType.MESSAGE_FEATURIZER, is_trainable=False
)
class FuzzyWuzzyClassifier(GraphComponent):
    def __init__(
        self,
        threshold: int = 90
    ):
        self.threshold = threshold
        self.lookup_tables = read_yaml_file("./lookup_tables.yml")

    @staticmethod
    def required_packages() -> List[Text]:
        return ["thefuzz"]

    @classmethod
    def create(
        cls,
        config: Dict[Text, Any],
        model_storage: ModelStorage,
        resource: Resource,
        execution_context: ExecutionContext,
    ) -> GraphComponent:
        return cls()

    def process(self, messages: List[Message]) -> List[Message]:
        for message in messages:
            lookup_table = self.lookup_tables
            print("wuzzy lookup_table", lookup_table)
            print("wuzzz message", message.get(TEXT))
            print("wuzzz message", message.get(ENTITIES))
            for entity in message.get(ENTITIES):
                print("wuzzy entity", entity)
                if entity["entity"] in lookup_table:
                    # Perform fuzzy matching
                    input_value = entity["value"]
                    closest_match, closest_ratio = process.extractOne(
                        input_value.lower(),
                        lookup_table[entity["entity"]],
                        scorer=fuzz.token_sort_ratio,
                    )
                    print("wuzzy ", closest_match, closest_ratio)
                    if closest_ratio >= self.threshold:
                        print("wuzzy got closest_match", closest_match)
                        entity["value"] = closest_match
                        entity["confidence"] = closest_ratio / 100.0
                        message.set("entities", entity)
        return messages

    def process_training_data(self, training_data: TrainingData) -> TrainingData:
        """Processes the training examples in the given training data in-place."""
        self.process(training_data.training_examples)
        return training_data
