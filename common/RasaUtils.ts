import { Intent, RasaDetectedEntity } from "./types";

export function mergeRepeatedEntities(entities: RasaDetectedEntity[]): RasaDetectedEntity[] {
  // Sort the entities by their start position
  const sortedEntities = entities.sort((a, b) => a.start - b.start);
  const nonClashingEntities: RasaDetectedEntity[] = [];

  let i = 0;
  while (i < sortedEntities.length) {
    const currentEntity = sortedEntities[i];
    const clashingEntities: RasaDetectedEntity[] = [currentEntity];

    // Find all clashing entities with overlapping start and end positions
    for (let j = i + 1; j < sortedEntities.length; j++) {
      const nextEntity = sortedEntities[j];
      if (nextEntity.start < currentEntity.end) {
        clashingEntities.push(nextEntity);
      } else {
        break;
      }
    }

    // Choose the entity with the highest confidence score among the clashing entities
    const highestConfidenceEntity = clashingEntities.reduce(
      (maxConfidenceEntity, entity) =>
        entity.confidence_entity > maxConfidenceEntity.confidence_entity
          ? entity
          : maxConfidenceEntity,
    );
    nonClashingEntities.push(highestConfidenceEntity);

    // Move to the next non-clashing entity
    i += clashingEntities.length;
  }

  return nonClashingEntities;
}

export function sortRasaEntities(entities: RasaDetectedEntity[],intent: Intent): RasaDetectedEntity[] {
    const retEnts: RasaDetectedEntity[] = []
    if (!intent.entities) {
        return entities
    }

    for (const intEnt of intent.entities) {
        const entKey = intEnt.split("@")[0]
        /// expect only 1 return
        const [matchedEnt] = entities.filter((ent) => {
            if (ent.entity.startsWith(intent.id + "_")) {
                return ent.group === entKey
            }
            return ent.entity === entKey
        })
        if (matchedEnt) {
            retEnts.push(matchedEnt)
        }

    }
    return retEnts;

}