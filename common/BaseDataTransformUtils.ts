import { CustomerSettings, EntityInstance, EntitySynonymType, SalesItem, Response } from "./types";
import * as Combinatorics from 'js-combinatorics'
import { SysNumber } from "./sys.number";
import { AlchoholTypes } from "./Alchohol";
import { RealEstateTypes } from "./RealEstateTypes"
import { Affirm } from "./Affirm";
import { Deny } from "./Deny";
import { Polite } from "./Polite";
import { getJmesPathActionData, getStateMods, renderString } from "./Utils";
export function getStandardObjectValues(settings: CustomerSettings, key: string, numValue: 1): any[] {
  let ret: any[] = [];

  const standardObjs = getStandardObjects(settings)
  let matchedValue = standardObjs[key];
  if (!matchedValue) {
    const [maps, arrays, ents] = getStateMods(settings.Intents)
    if (ents[key]) {
      ret.push(...getStandardObjectValues(settings, ents[key], numValue))
    }
    else if (arrays[key]) {
      ret.push(...getStandardObjectValues(settings, arrays[key], numValue))
    } else if (maps[key]) {
      const mapValue = {} as any;
      Object.keys(maps[key]).forEach((mKey) => {
        mapValue[mKey] = getStandardObjectValues(settings, maps[key][mKey], numValue)[0]
      })
      ret.push(mapValue)
    } else {
      throw new Error("getStandardObjectValues cant match key " + key)
    }
  } else {
    for (let i = 0; i < numValue; ++i) {
      if (matchedValue[i]) {
        if (matchedValue[i].value) {
          ret.push(matchedValue[i].value)
          if (matchedValue[i].synonyms) {
            let numSyn = 0
            for (const syn of matchedValue[i].synonyms) {
              if ((i + numSyn) == numValue) {
                break;
              }
              ret.push(...matchedValue[i].synonyms[numSyn])
              ++numSyn;
            }
            i += numSyn + 1

          }
        } else {
          ret.push(matchedValue[i])
        }

      }
    }
  }

  return ret;
}

/// @base function to get string[] and {value, synonyms}[] to output string[]
export function getValuesFromEntitySynonym(input: EntitySynonymType[], onlyMainValue?: boolean): string[] {
  const ret: string[] = []
  for (const i of input) {
    if (typeof i === "string") {
      ret.push(i)
    } else {
      ret.push(i.value)
      if (!onlyMainValue && i.synonyms) {
        ret.push(...i.synonyms)
      }
    }
  }
  return ret;
}


export function getMainValueFromEntitySynonym(input: EntitySynonymType[], value: string): string | null {
  for (const i of input) {
    if (typeof i === "string") {
      if (value === i) {
        return value
      }
    } else {
      if (i.value === value) {
        return i.value
      }
      if (i.synonyms.includes(value)) {
        return i.value
      }
    }
  }
  return null
}
export function getStandardObjects(settings: CustomerSettings): { [key: string]: any[] } {
  if (settings.nlu === "es") {
    return {
      SalesItems: buildMenuList(settings.SalesItems),
      SalesItemSizes: buildMenuItemSizes(settings.SalesItems),
      AlchoholTypes,
      RealEstateTypes,
      SysNumber: SysNumber,
      Polite
      // Affirm,
      // Deny
    }
  } else {
    return {
      SalesItems: buildMenuListRasa(settings.SalesItems),
      SalesItemSizes: buildMenuItemSizes(settings.SalesItems),
      AlchoholTypes: AlchoholTypes,
      RealEstateTypes,
      SysNumber: SysNumber,
      Polite: Polite,
      // Affirm,
      // Deny
    }
  }
}

export function getRasaDomainLookup(settings: CustomerSettings): { [key: string]: any[] } {
  return {
    SalesItems: buildMenuListRasa(settings.SalesItems),
    SalesItemSizes: generateLookupTable(buildMenuItemSizes(settings.SalesItems)),
    AlchoholTypes: generateLookupTable(AlchoholTypes),
    RealEstateTypes: generateLookupTable(RealEstateTypes),
    SysNumber: generateLookupTable(SysNumber),
    Polite: generateLookupTable(Polite),
    // Affirm,
    // Deny
  }
}
export function buildMenuList(Menu: SalesItem[]): EntityInstance[] {
  const ret: EntityInstance[] = []
  for (const menuItem of Menu) {
    ret.push(
      {
        value: menuItem.display_name,
        synonyms: menuItem.synonyms
      }
    )
  }
  return ret
}

export function buildMenuListRasa(menu: SalesItem[]): string[] {
  return menu.map((m) => m.display_name)
}
export function buildMenuItemSizes(Menu: SalesItem[]): EntityInstance[] {
  const ret: EntityInstance[] = []
  const tmpSizeArray: string[] = [];
  for (const menuItem of Menu) {
    if (menuItem.sizes) {
      for (const size of menuItem.sizes) {
        if (!tmpSizeArray.includes(size.name)) {
          tmpSizeArray.push(size.name)
          ret.push(
            {
              value: size.name,
              synonyms: size.synonyms
            }
          )
        }

      }
    }


  }
  return ret
}
export function buildMenuItemSizesRasa(Menu: SalesItem[]): string[] {
  const ret: string[] = []
  const tmpSizeArray: string[] = [];
  for (const menuItem of Menu) {
    if (menuItem.sizes) {
      for (const size of menuItem.sizes) {
        if (!tmpSizeArray.includes(size.name)) {
          tmpSizeArray.push(size.name)
          ret.push(
            size.name
          )
        }

      }
    }
  }
  return ret
}
export function getCombinations(entityNames: string[], queryItems: string[], StaticData: { [key: string]: EntityInstance[] }) {
  const entityValueCombinations = entityNames.map(entityName => {
    const entity = StaticData[entityName];
    const values = entity.map(entityInstance => entityInstance.value);
    const synonyms = entity.flatMap(entityInstance => entityInstance.synonyms);
    return [...values, ...synonyms];
  });

  const product = new Combinatorics.CartesianProduct(...entityValueCombinations);
  const combinations = product.toArray().map(combination => {
    const combinationObj: { [key: string]: string } = {};
    for (let i = 0; i < entityNames.length; i++) {
      combinationObj[queryItems[i]] = combination[i];
    }
    return combinationObj;
  });

  return combinations;
}
export function generateLookupTable(entityInstances: EntityInstance[]): any {
  const lookupTable: { [key: string]: string[] } = {};

  entityInstances.forEach((entity) => {
    lookupTable[entity.value] = [...entity.synonyms];
  });

  return lookupTable;
}


/// @dev process getAction output with jmesPath on responsetext

export function getActionOutput(text: string, settings: any, response?: Response): any {
  let actionOutput: any
  let objectMapData = getJmesPathActionData(
    renderString(text, settings),
    settings
  )
  console.log("get action output objectMapData", JSON.stringify(objectMapData, null, 4), text, renderString(text, settings))
  if (!objectMapData) {
    throw new Error("cant get objectMapData")
  }
  if (Array.isArray(objectMapData)) {
    if (Array.isArray(objectMapData[0])) {
      // array of arrays, compress internal arrays first
      for (let i = 0; i < objectMapData.length; ++i) {
        let instanceText = "";
        const instance = objectMapData[i]
        for (let y = 0; y < instance.length; ++y) {
          if (instanceText !== "") {
            instanceText += " "
          }
          instanceText += instance[y]
        }
        objectMapData[i] = instanceText
      }
    }

    // if response is of EntitySynonym type, convert it to a list of main values
    if (objectMapData[0].value) {
      objectMapData = getValuesFromEntitySynonym(objectMapData, true)
      console.log("getActionOutput got entitySynonym type, converting to list", objectMapData)
    }

    if (response && response.prefixActionOutputArray) {
      objectMapData = objectMapData.map((txt: string) => {
        return response.prefixActionOutputArray + txt
      })
    }
    actionOutput = renderListStrings(objectMapData)


  } else {
    // we are expecting a jsonobject here for complex queries
    for (const key of Object.keys(objectMapData)) {
      if (Array.isArray(objectMapData[key])) {
        objectMapData[key] = renderListStrings(objectMapData[key])
      }
    }
    actionOutput = objectMapData
  }
  return actionOutput

}

/// @dev transorm last , into and
export function renderListStrings(items: string[]): string {
  const length = items.length;
  let result = "";
  for (let i = 0; i < length; i++) {
    if (i === 0) {
      result += items[i];
    } else if (i === length - 1) {
      result += ` and ${items[i]}`;
    } else {
      result += `, ${items[i]}`;
    }
  }
  return result;
}